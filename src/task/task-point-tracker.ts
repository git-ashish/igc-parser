import Task from "./task";
import {Fix} from "../read-flight";
import Event from "./events/event";
import StartEvent from "./events/start";
import FinishEvent from "./events/finish";
import TurnEvent from "./events/turn";
import {interpolateFix} from "../utils/interpolate-fix";
import AreaShape from "./shapes/area";

export default class TaskPointTracker {
  task: Task;

  events: Event[] = [];

  private _lastFix: Fix | undefined = undefined;

  constructor(task: Task) {
    this.task = task;
  }

  consume(fixes: Fix[]) {
    fixes.forEach(fix => this.update(fix));
  }

  update(fix: Fix) {
    if (this._lastFix) {
      this._update(fix, this._lastFix);
    }
    this._lastFix = fix;
  }

  _update(fix: Fix, lastFix: Fix) {
    let start = this.task.checkStart(lastFix, fix);
    if (start !== undefined) {
      this.events.push(new StartEvent(interpolateFix(lastFix, fix, start)));
    }

    for (let i = 1; i < this.task.points.length - 1; i++) {
      let prevTPReached = this.events.some(i === 1 ?
        (event => event instanceof StartEvent) :
        (event => event instanceof TurnEvent && event.num === i - 1));

      if (prevTPReached) {
        // SC3a §6.3.1b
        //
        // A Turn Point is achieved by entering that Turn Point's Observation Zone.

        let tp = this.task.points[i];
        if (tp.shape instanceof AreaShape && !tp.shape.isInside(lastFix.coordinate) && tp.shape.isInside(fix.coordinate)) {
          this.events.push(new TurnEvent(fix, i));
        }
      }
    }

    let lastTPReached = this.events.some(event => event instanceof TurnEvent && event.num === this.task.points.length - 2);
    if (lastTPReached) {
      let finish = this.task.checkFinish(lastFix, fix);
      if (finish !== undefined) {
        this.events.push(new FinishEvent(interpolateFix(lastFix, fix, finish)));
      }
    }
  }
}