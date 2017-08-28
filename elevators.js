{
  init: function(elevators, floors) {
    // Strategy
    //
    // Let elevators go up and down, 
    // taking on passengers if they match the direction.
    //
    // Note that passengers will press the button again if they fail to enter an elevator.
    //
    // Load factor of one person is between 0.15 and 0.21
    //
    // When button is pressed at a floor.
    //   1. Find closest elevator that matches direction and is above/below and has a load <= 0.5
    //   2. Add to global up/downqueue.
    //
    //   When an elevator was found:
    //     Send that elevator to that floor and sort the destination queue.
    //
    // When button pressed in elevator:
    //   It must match our current direction!
    //   Sort the destination queue.
    //
    // When elevator is idle
    //
    //   Check if elevator is high or low
    //
    //   If high set direction down and then take 3? floors from the down queue.
    //   If low then same respectively.
    //   If both queues empty, go to 0.
    //     

    var upQueue = {};
    var downQueue = {};

    elevators.forEach(function (elevator, index) {
      elevator.index = index;
      registerElevator(elevator);
    });

    floors.forEach(function (floor, index) {
      registerFloor(floor);
    });

    function registerFloor(floor) {
      floor.on("up_button_pressed", function() {
        buttonPressedAtFloor(this.floorNum(), true);
      });
      floor.on("down_button_pressed", function() {
        buttonPressedAtFloor(this.floorNum(), false);
      });
    }

    function registerElevator(elevator) {
      elevator.isQueueEmpty = isDestinationQueueEmpty;
      elevator.isCurrentlyHigh = isCurrentlyHigh;
      elevator.setDiscreteDirection = setDiscreteDirection;
      elevator.clearDirection = clearDirection;
      elevator.addFloorCall = addFloorCall;
      elevator.sortDestinationQueue = sortDestinationQueue;
      elevator.canTakeAnother = shouldTakeAnotherOnTheWay;
      elevator.homeFloor = homeFloor;
      elevator.goTowardsHomeFloor = goTowardsHomeFloor;
      elevator.clearDirection();

      elevator.on("floor_button_pressed", floorButtonPressedForElevator);
      elevator.on("idle", elevatorIdle);
      elevator.on("stopped_at_floor", elevatorStoppedAtFloor);
    }

    function elevatorStoppedAtFloor(floorNum) {
    }

    function shouldTakeAnotherOnTheWay() {
      return this.loadFactor() < 0.3 || (this.loadFactor() < 0.4 && this.destinationQueue.length <= 1)
    }

    function homeFloor() {
      var onePart = (floors.length / elevators.length);
      return Math.max(Math.ceil(onePart * (this.index - 1)), 0);
    }

    function goTowardsHomeFloor() {
      this.goToFloor(this.currentFloor() + Math.round((this.homeFloor() - this.currentFloor()) / 2))
      this.clearDirection();
    }

    function isDestinationQueueEmpty() {
      return (this.destinationQueue.length === 0);
    }

    function isCurrentlyHigh() {
      return (this.currentFloor() / floors.length) >= 0.5;
    }

    function setDiscreteDirection(goingUp) {
      this.goingUpIndicator(goingUp);
      this.goingDownIndicator(!goingUp);
    }

    function clearDirection() {
      this.goingUpIndicator(true);
      this.goingDownIndicator(true);
    }

    // This function should be only called for elevator that matches the direction
    function addFloorCall(floorNum) {
      //   When an elevator was found:
      //   Send that elevator to that floor and sort the destination queue.
      this.destinationQueue.push(floorNum);
      this.sortDestinationQueue();
    }

    function sortDestinationQueue() {
      if (this.goingUpIndicator()) {
        this.destinationQueue = _.unique(this.destinationQueue.sort());
      } else {
        this.destinationQueue = _.unique(this.destinationQueue.sort().reverse());
      }
      this.checkDestinationQueue();
    }

    function buttonPressedAtFloor(floorNum, goingUp) {
      var elevator = findClosestMatchingElevator(goingUp, floorNum);
      if (elevator) {
        console.log("find suitable elevator", elevator.index, " up? ", goingUp, " to ", floorNum);
        // set discrete direction in case the elevator allowed both before
        elevator.setDiscreteDirection(goingUp);
        elevator.addFloorCall(floorNum);
      } else {
        if (goingUp) {
          upQueue[floorNum] = upQueue[floorNum] || +new Date();
        } else {
          downQueue[floorNum] = downQueue[floorNum] || +new Date();
        }
      }
    }

    function findClosestMatchingElevator(goingUp, floorNum) {
      //   Find closest elevator that matches direction and is above/below and has a load <= 0.5
      var suitableElevators = elevators.filter(function(elevator) {
        if (goingUp && elevator.goingUpIndicator()) {
          return (elevator.canTakeAnother() && elevator.currentFloor() <= floorNum && Math.abs(elevator.currentFloor() - floorNum) <= 3);
        } else if (!goingUp && elevator.goingDownIndicator()) {
          return (elevator.canTakeAnother() && elevator.currentFloor() >= floorNum && Math.abs(elevator.currentFloor() - floorNum) <= 3);
        } else {
          return false;
        }
      });
      if (suitableElevators.length === 0) {
        console.log("no suitable elevators up?", goingUp, " to ", floorNum);
        return null;
      }
      console.log("found suitable elevators up?", goingUp, " to ", floorNum, suitableElevators);
      return suitableElevators.reduce(function(best, next) {
        if (!next) {
          return best;
        }
        var nextDistance = Math.abs(next.currentFloor() - floorNum);
        var bestDistance = Math.abs(best.currentFloor() - floorNum);
        if (nextDistance == bestDistance) {
          return Math.abs(next.homeFloor() - floorNum) <= Math.abs(best.homeFloor() - floorNum) && next || best;
        }
        return nextDistance <= bestDistance && next || best;
      });
    }

    function stoppedAtFloor(floorNum) {
    }

    function floorButtonPressedForElevator(floorNum) {
      if (this.goingUpIndicator() && this.goingDownIndicator()) {
        var goUp = this.currentFloor() < floorNum;
        console.log("button pressed while no direction!", "up?", goUp, logElevator(this));
        this.setDiscreteDirection(goUp);
      }
      if (this.goingUpIndicator() && this.currentFloor() > floorNum) {
        console.error("wut pressed floor", floorNum , logElevator(this));
      } else if (this.goingDownIndicator() && this.currentFloor() < floorNum) {
        console.error("wut2 pressed floor", floorNum , logElevator(this));
      }
      // When button pressed in elevator:
      //   It must match our current direction!
      //   Sort the destination queue.
      this.addFloorCall(floorNum);
    }

    function elevatorIdle() {
      //   Check if elevator is high or low
      //
      //   If high set direction down and then take 3? highest floors from the down queue.
      //   If low then same respectively.
      //   If both queues empty, go to 0.
      //     
      console.log("elevator idle ", this.index,  " up queue ", upQueue, " down queue " , downQueue);
      var now = +new Date();
      var allWaiting = _.values(upQueue).concat(_.values(downQueue))
      var waitTimes = allWaiting.map(function(waitStart) {
        return (now - waitStart) / 1000;
      });
      var maxWaitTime = _.max(waitTimes);
      if (maxWaitTime > 2) {
        console.log("one guy already waited for", maxWaitTime);
      }
      var upFloors = _.keys(upQueue);
      var downFloors = _.keys(downQueue);
      if (upFloors.length > downFloors.length + 2) {
        console.log("going to 0 because up queue was much bigger");
        this.goTowardsHomeFloor();
      } else if (upFloors.length === 0 && downFloors.length === 0) {
        console.log("going to 0 because because queues were empty");
        this.goTowardsHomeFloor();
      } else {
        var candidates;
        if (this.isCurrentlyHigh() && downFloors.length > 0 || upFloors.length == 0) {
          this.setDiscreteDirection(false);
          candidates = _.take(downFloors.concat([]).sort().reverse(), 3);
          downQueue = _.omit(downQueue, candidates.map(function(val) { return val.toString() }));
          console.log("after idle took down candidates", candidates);
        } else if (!this.isCurrentlyHigh() && upFloors.length > 0 || downFloors.length == 0) {
          this.setDiscreteDirection(true);
          candidates = _.take(upFloors.concat([]).sort(), 3);
          upQueue = _.omit(upQueue, candidates.map(function(val) { return val.toString() }));
          console.log("after idle took up candidates", candidates);
        } 

        this.destinationQueue = this.destinationQueue.concat(candidates);
        this.sortDestinationQueue();
      }
    }

    function logElevator(elevator) {
      return "elevator: " +  elevator.index + " currentFloor: " +  elevator.currentFloor() +  " queue: [" + elevator.destinationQueue + "] up?: " + elevator.goingUpIndicator() + " down?: " + elevator.goingDownIndicator();
    }

  },  update: function(dt, elevators, floors) {
    // NOP
  }
}

