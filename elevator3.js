{
  init: function(elevators, floors) {

    elevators.forEach(function (elevator, index) {
      elevator.index = index;
      registerElevator(elevator, floors);
    });

    floors.forEach(function (floor, index) {
      registerFloor(floor);
    });

    function registerFloor(floor) {
      floor.on("up_button_pressed", upPressedAtFloor);
      floor.on("down_button_pressed", downPressedAtFloor);
    }

    function registerElevator(elevator, floors) {
      elevator.upQueue = [];
      elevator.downQueue = [];
      elevator.queueEmpty = function() {
        return (this.destinationQueue.length === 0);
      };
      elevator.setDirection = function(goingUp) {
        elevator.goingUpIndicator(goingUp);
        elevator.goingDownIndicator(!goingUp);
      };
      elevator.on("floor_button_pressed", floorButtonPressedForElevator);
      elevator.on("stopped_at_floor", elevatorStoppedAtFloor);
      elevator.on("passing_floor", elevatorPassingFloor);
      elevator.on("idle", elevatorIdle);
    }

    function findBestElevator(goingUp, floorNum) {
      return elevators.reduce(function(best, next) {
        if (!next) {
          return best;
        }
        if (matchesDirection(next, goingUp, floorNum) && !matchesDirection(best, goingUp, floorNum)) {
          return best;
        }
        if (!(next.goingUpIndicator() ^ goingUp) && (best.goingUpIndicator ^ goingUp)) {
          return next;
        }
        var nextDistance = Math.abs(next.currentFloor() - floorNum);
        var bestDistance = Math.abs(best.currentFloor() - floorNum);
        return nextDistance <= bestDistance && next || best;
      });
    }

    function upPressedAtFloor() {
      var floorNum = this.floorNum();
      var elevator = findBestElevator(true, floorNum);
      addUpCall(elevator, floorNum);
    }

    function downPressedAtFloor() {
      var floorNum = this.floorNum();
      console.info("Down pressed at floor", floorNum);
      var elevator = findBestElevator(false, floorNum);
      addDownCall(elevator, floorNum);
    }

    function addUpCall(elevator, floorNum) {
      elevator.upQueue.push(floorNum);
      checkQueueAfterCall(elevator, true, floorNum);
    }

    function addDownCall(elevator, floorNum) {
      elevator.downQueue.push(floorNum);
      checkQueueAfterCall(elevator, false, floorNum);
    }

    function checkQueueAfterCall(elevator, isUpCall, floorNum) {
      if (elevator.queueEmpty()) {
        elevator.setDirection(isUpCall);
        if (isUpCall) {
          popUpQueue(elevator);
        } else {
          popDownQueue(elevator);
        }
      } else if (matchesDirection(elevator, isUpCall, floorNum) && fitsAnother(elevator)) {
        console.error("matches direction!", logElevator(elevator));
        var queueToPopFrom = isUpCall && elevator.upQueue || elevator.downQueue;
        elevator.destinationQueue.push(queueToPopFrom.pop());
        sortDestinationQueue(elevator);
      }
    }

    function fitsAnother(elevator) {
      return elevator.loadFactor() <= 0.7
    }

    function popUpQueue(elevator) {
      elevator.destinationQueue = elevator.upQueue;
      elevator.upQueue = [];
      elevator.setDirection(true);
      sortDestinationQueue(elevator);
    }

    function popDownQueue(elevator) {
      elevator.destinationQueue = elevator.downQueue;
      elevator.downQueue = [];
      elevator.setDirection(false);
      sortDestinationQueue(elevator);
    }

    function matchesDirection(elevator, isUpCall, floorNum) {
      var matchDirection = elevator.goingUpIndicator() && isUpCall || elevator.goingDownIndicator() && !isUpCall;
      var onTheWay;
      if (isUpCall){
        onTheWay = elevator.currentFloor() <= floorNum && (elevator.queueEmpty() || elevator.destinationQueue[0] >= floorNum);
      } else {
        onTheWay = elevator.currentFloor() >= floorNum && (elevator.queueEmpty() || elevator.destinationQueue[0] <= floorNum);
      }

      return matchDirection && onTheWay;
    }

    function sortDestinationQueue(elevator) {
      var inDirection;
      if (elevator.goingUpIndicator()){
        inDirection = elevator.destinationQueue.filter(function(val){
          return val >= elevator.currentFloor();
        });
      } else {
        inDirection = elevator.destinationQueue.filter(function(val){
          return val <= elevator.currentFloor();
        });
      }

      var outOfDirection = elevator.destinationQueue.filter(function(val){
        return inDirection.indexOf(val) == -1;
      });

      if (elevator.goingUpIndicator) {
        elevator.destinationQueue = inDirection.sort().concat(outOfDirection);
      } else {
        elevator.destinationQueue = inDirection.sort().reverse().concat(outOfDirection);
      }

      var uniqueQueue = elevator.destinationQueue.reduce(function(sorted, val){
        if (sorted.indexOf(val) == -1) {
          sorted.push(val);
          return sorted;
        } else {
          return sorted;
        }
      }, []);
      elevator.destinationQueue = uniqueQueue;
      elevator.checkDestinationQueue();
    }

    function floorButtonPressedForElevator(floorNum) {
      var wantsToGoUp = (floorNum > this.currentFloor())
      if (!(wantsToGoUp ^ this.goingUpIndicator())) {
        this.destinationQueue.push(floorNum);
        sortDestinationQueue(this);
      } else if (wantsToGoUp) {
        this.upQueue.push(floorNum);
      } else {
        this.downQueue.push(floorNum);
      }
    }

    function elevatorStoppedAtFloor() {
    }

    function elevatorIdle() {
      if (this.queueEmpty()) {
        var goUp = findNextDirection(this);
        if (goUp) {
          popUpQueue(this);
        } else {
          popDownQueue(this);
        }
        if (this.queueEmpty()) {
          this.goingUpIndicator(true);
          this.goingDownIndicator(true);
          this.goToFloor(0);
        }
      }
    }

    // Returns true if up false if down
    function findNextDirection(elevator) {
      if (elevator.upQueue.length == 0) {
        return false;
      } else if (elevator.downQueue.length == 0) {
        return true;
      }
      var currentFloor = elevator.currentFloor();
      var closestUp    = findClosest(currentFloor, elevator.upQueue);
      var closestDown  = findClosest(currentFloor, elevator.downQueue);
      var upDistance   = Math.abs(currentFloor - closestUp);
      var downDistance = Math.abs(currentFloor - closestDown);
      if (upDistance == downDistance) {
        // prefer current direction
        return elevator.goingUpIndicator(); 
      } else {
        return upDistance < downDistance;
      }
    }

    function findClosest(target, queue) {
      return queue.reduce(function(next, best) {
        var nextDistance = Math.abs(target - next);
        var bestDistance = Math.abs(target - best);
        return (nextDistance <= bestDistance) && next || best;
      });
    }

    function elevatorPassingFloor() {
      // NOP
    }



    function logElevator(elevator) {
      return "elevator: " +  elevator.index + " currentFloor: " +  elevator.currentFloor() +  " queue: [" + elevator.destinationQueue + "] up?: " + elevator.goingUpIndicator() + " down?: " + elevator.goingDownIndicator();
    }

  },  update: function(dt, elevators, floors) {
    // NOP
  }
}

