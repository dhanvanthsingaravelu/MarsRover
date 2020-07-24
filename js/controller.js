var Controller = StateMachine.create({
    initial: 'none',
    events: [
        {
            name: 'init',
            from: 'none',
            to: 'ready'
        },
        { // additional event to revert back to none from any existing state.
            name: 'rebuild',
            from: '*',
            to: 'none'
        },
        {
            name: 'search',
            from: 'starting',
            to: 'searching'
        },
        {
            name: 'pause',
            from: 'searching',
            to: 'paused'
        },
        {
            name: 'finish',
            from: 'searching',
            to: 'finished'
        },
        {
            name: 'resume',
            from: 'paused',
            to: 'searching'
        },
        {
            name: 'cancel',
            from: 'paused',
            to: 'ready'
        },
        {
            name: 'modify',
            from: 'finished',
            to: 'modified'
        },
        {
            name: 'reset',
            from: '*',
            to: 'ready'
        },
        {
            name: 'clear',
            from: ['finished', 'modified'],
            to: 'ready'
        },
        {
            name: 'start',
            from: ['ready', 'modified', 'restarting'],
            to: 'starting'
        },
        {
            name: 'restart',
            from: ['searching', 'finished'],
            to: 'restarting'
        },
        {
            name: 'dragStart',
            from: ['ready', 'finished'],
            to: 'draggingStart'
        },
        {
            name: 'dragEnd',
            from: ['ready', 'finished'],
            to: 'draggingEnd'
        },
        { // option to drag second destination only when the event is either ready or       finshed.
            name: 'dragEndtwo',
            from: ['ready', 'finished'],
            to: 'draggingEndtwo'
        },
        {
            name: 'drawWall',
            from: ['ready', 'finished'],
            to: 'drawingWall'
        },
        {
            name: 'eraseWall',
            from: ['ready', 'finished'],
            to: 'erasingWall'
        },
        {
            name: 'rest',
            from: ['draggingStart', 'draggingEnd', 'draggingEndtwo', 'drawingWall', 'erasingWall'],
            to: 'ready'
        },
    ],
});

$.extend(Controller, {
    gridSize: [36, 20], // grid size defined as per our working screen.
    operationsPerSecond: 300,

   
    onleavenone: function () {
        var numCols = this.gridSize[0],
            numRows = this.gridSize[1];
        View.deleteGrid();
        delete this.grid;


        width = $(window).width();
        height = $(window).height();

        this.grid = new PF.Grid(numCols, numRows);

        View.init({
            numCols: numCols,
            numRows: numRows
        });
        View.generateGrid(function () {
            Controller.setDefaultStartEndPos();
            Controller.bindEvents();
            Controller.transition(); // transit to the next state (ready)
        });

        this.$buttons = $('.control_button');

        this.hookPathFinding();

        return StateMachine.ASYNC;
        // => ready state
    },
    ondrawWall: function (event, from, to, gridX, gridY) {
        this.setWalkableAt(gridX, gridY, false);
        // => Wall Drawn
    },
    oneraseWall: function (event, from, to, gridX, gridY) {
        this.setWalkableAt(gridX, gridY, true);
        // => Wall erased
    },
    onsearch: function (event, from, to) {
        if ($('input[name=option]:checked').val() === "one") { // when single destination option is selected.
            var grid,
                timeStart, timeEnd,
                finder = Panel.getFinder();
            timeStart = window.performance ? performance.now() : Date.now();
            grid = this.grid.clone();
            this.path = finder.findPath(
                this.startX, this.startY, this.endX, this.endY, grid
            );


        } else { // when dual destination option is selected.
            var grid, path1, path2, path3,
                timeStart, timeEnd,
                finder = Panel.getFinder();
            timeStart = window.performance ? performance.now() : Date.now();
            grid = this.grid.clone();
            grid1 = this.grid.clone();// cloning the grid each time for every new search to enable searching even in the closed nodes of previous search.
            grid2 = this.grid.clone();
            path1 = finder.findPath(
                this.startX, this.startY, this.endX, this.endY, grid
            );
            path2 = finder.findPath(
                this.startX, this.startY, this.endXtwo, this.endYtwo, grid1
            );
            if (path1.length < path2.length) { // finding the nearest destination to rover.
                path3 = finder.findPath(
                    this.endX, this.endY, this.endXtwo, this.endYtwo, grid2
                );
                this.path = path1.concat(path3);
            } else {
                path3 = finder.findPath(// algorithm selected from panel is employed to find the shortest path.
                    this.endXtwo, this.endYtwo, this.endX, this.endY, grid2
                );
                this.path = path2.concat(path3); // finaly path merged.
            }


        }
        this.operationCount = this.operations.length;
        timeEnd = window.performance ? performance.now() : Date.now();
        this.timeSpent = (timeEnd - timeStart).toFixed(4);

        this.loop();
        // => Search in progress


    },
    onrestart: function () {
        setTimeout(function () {
            Controller.clearOperations();
            Controller.clearFootprints();
            Controller.start();
        }, View.nodeColorizeEffect.duration * 1.2);
        // Restart in action
    },
    onpause: function (event, from, to) {
        // State Paused
    },
    onresume: function (event, from, to) {
        this.loop();
        // Search in progress
    },
    oncancel: function (event, from, to) {
        this.clearOperations();
        this.clearFootprints();
        // State Ready
    },
    onfinish: function (event, from, to) {
        View.showStats({
            pathLength: PF.Util.pathLength(this.path),
            timeSpent: this.timeSpent,
            operationCount: this.operationCount,
        });
        View.drawPath(this.path);
        // => Finished
    },
    onclear: function (event, from, to) {
        this.clearOperations();
        this.clearFootprints();
        // State Ready
    },
    onmodify: function (event, from, to) {
        // Modified
    },
    onreset: function (event, from, to) {
        setTimeout(function () {
            Controller.clearOperations();
            Controller.clearAll();
            Controller.buildNewGrid();
        }, View.nodeColorizeEffect.duration * 1.2);
        // State Ready
    },

    /**
     * Below defined functions are called upon only on entering states.
     */

    onready: function () {
        console.log('=> ready');

        this.setButtonStates({
            id: 1,
            text: 'Start Search',
            enabled: true,
            callback: $.proxy(this.start, this),
        }, {
            id: 2,
            text: 'Pause Search',
            enabled: false,
        }, {
            id: 3,
            text: 'Clear Walls',
            enabled: true,
            callback: $.proxy(this.reset, this),
        });
    },
    onstarting: function (event, from, to) {
        console.log('=> starting');
        // Removes all preceeded search changes in grid
        this.clearFootprints();
        this.setButtonStates({
            id: 2,
            enabled: true,
        });
        this.search();
        // Search in Progress
    },
    onsearching: function () {
        console.log('=> searching');
        this.setButtonStates({
            id: 1,
            text: 'Restart Search',
            enabled: true,
            callback: $.proxy(this.restart, this),
        }, {
            id: 2,
            text: 'Pause Search',
            enabled: true,
            callback: $.proxy(this.pause, this),
        });
    },
    onpaused: function () {
        console.log('=> paused');
        this.setButtonStates({
            id: 1,
            text: 'Resume Search',
            enabled: true,
            callback: $.proxy(this.resume, this),
        }, {
            id: 2,
            text: 'Cancel Search',
            enabled: true,
            callback: $.proxy(this.cancel, this),
        });
    },
    onfinished: function () {
        console.log('=> finished');
        this.setButtonStates({
            id: 1,
            text: 'Restart Search',
            enabled: true,
            callback: $.proxy(this.restart, this),
        }, {
            id: 2,
            text: 'Clear Path',
            enabled: true,
            callback: $.proxy(this.clear, this),
        });
    },
    onmodified: function () {
        console.log('=> modified');
        this.setButtonStates({
            id: 1,
            text: 'Start Search',
            enabled: true,
            callback: $.proxy(this.start, this),
        }, {
            id: 2,
            text: 'Clear Path',
            enabled: true,
            callback: $.proxy(this.clear, this),
        });
    },


    
    hookPathFinding: function () {

        PF.Node.prototype = {
            get opened() {
                return this._opened;
            },
            set opened(v) {
                this._opened = v;
                Controller.operations.push({
                    x: this.x,
                    y: this.y,
                    attr: 'opened',
                    value: v
                });
            },
            get closed() {
                return this._closed;
            },
            set closed(v) {
                this._closed = v;
                Controller.operations.push({
                    x: this.x,
                    y: this.y,
                    attr: 'closed',
                    value: v
                });
            },
            get tested() {
                return this._tested;
            },
            set tested(v) {
                this._tested = v;
                Controller.operations.push({
                    x: this.x,
                    y: this.y,
                    attr: 'tested',
                    value: v
                });
            },
        };

        this.operations = [];
    },
    bindEvents: function () {
        $('#draw_area').mousedown($.proxy(this.mousedown, this));
        $(window)
            .mousemove($.proxy(this.mousemove, this))
            .mouseup($.proxy(this.mouseup, this));
    },
    loop: function () {
        var interval = 1000 / this.operationsPerSecond;
        (function loop() {
            if (!Controller.is('searching')) {
                return;
            }
            Controller.step();
            setTimeout(loop, interval);
        })();
    },
    step: function () {
        var operations = this.operations,
            op, isSupported;

        do {
            if (!operations.length) {
                this.finish(); // transit to `finished` state
                return;
            }
            op = operations.shift();
            isSupported = View.supportedOperations.indexOf(op.attr) !== -1;
        } while (!isSupported);

        View.setAttributeAt(op.x, op.y, op.attr, op.value);
    },
    clearOperations: function () {
        this.operations = [];
    },
    clearFootprints: function () {
        View.clearFootprints();
        View.clearPath();
    },
    clearAll: function () {
        this.clearFootprints();
        View.clearBlockedNodes();
    },
    buildNewGrid: function () {
        this.grid = new PF.Grid(this.gridSize[0], this.gridSize[1]);
    },
    mousedown: function (event) {
        var coord = View.toGridCoordinate(event.pageX, event.pageY),
            gridX = coord[0],
            gridY = coord[1],
            grid = this.grid;

        if (this.can('dragStart') && this.isStartPos(gridX, gridY)) {
            this.dragStart();
            return;
        }
        if (this.can('dragEnd') && this.isEndPos(gridX, gridY)) {
            this.dragEnd();
            return;
        }
        if (($('input[name=option]:checked').val() === "two") && this.can('dragEndtwo') && this.isEndPostwo(gridX, gridY)) {
            this.dragEndtwo();
            return;
        }
        if (this.can('drawWall') && grid.isWalkableAt(gridX, gridY)) {
            this.drawWall(gridX, gridY);
            return;
        }
        if (this.can('eraseWall') && !grid.isWalkableAt(gridX, gridY)) {
            this.eraseWall(gridX, gridY);
        }
    },
    mousemove: function (event) {
        var coord = View.toGridCoordinate(event.pageX, event.pageY),
            grid = this.grid,
            gridX = coord[0],
            gridY = coord[1];

        if ($('input[name=option]:checked').val() === "one") {
            if (this.isStartOrEndPos(gridX, gridY)) {
                return;
            }
        } else {
            if (this.isStartOrEndPosOrEndPostwo(gridX, gridY)) {
                return;
            }
        }



        switch (this.current) {
            case 'draggingStart':
                if (grid.isWalkableAt(gridX, gridY)) {
                    this.setStartPos(gridX, gridY);
                }
                break;
            case 'draggingEnd':
                if (grid.isWalkableAt(gridX, gridY)) {
                    this.setEndPos(gridX, gridY);
                }
                break;
            case 'draggingEndtwo':
                if (grid.isWalkableAt(gridX, gridY)) {
                    this.setEndPostwo(gridX, gridY);
                }
                break;
            case 'drawingWall':
                this.setWalkableAt(gridX, gridY, false);
                break;
            case 'erasingWall':
                this.setWalkableAt(gridX, gridY, true);
                break;
        }
    },
    mouseup: function (event) {
        if (Controller.can('rest')) {
            Controller.rest();
        }
    },
    setButtonStates: function () {
        $.each(arguments, function (i, opt) {
            var $button = Controller.$buttons.eq(opt.id - 1);
            if (opt.text) {
                $button.text(opt.text);
            }
            if (opt.callback) {
                $button
                    .unbind('click')
                    .click(opt.callback);
            }
            if (opt.enabled === undefined) {
                return;
            } else if (opt.enabled) {
                $button.removeAttr('disabled');
            } else {
                $button.attr({
                    disabled: 'disabled'
                });
            }
        });
    },
    /**
     * Each time the page is reloaded or new option is selected in panel
     * default positons of Rover, Water Source 1, Water Source 2(if option 2 selected),
     * is found and placed on the drawn grid.
     */
    setDefaultStartEndPos: function () {
        this.clearAll();
        View.clearStartEndPos();
        var centerX, centerY,

            centerX = Math.floor(this.gridSize[0] / 4.2);
        centerY = Math.floor(this.gridSize[1] / 4.5);

        if ($('input[name=option]:checked').val() === "one") {
            this.setStartPos(centerX - 5, centerY);
            this.setEndPos(centerX + 10, centerY + 1);
        } else {
            this.setStartPos(centerX - 5, centerY);// With respect to center, positions are determined.
            this.setEndPostwo(centerX + 13, centerY + 5);
            this.setEndPos(centerX + 10, centerY + 1);
        }

    },
    setStartPos: function (gridX, gridY) {
        this.startX = gridX;
        this.startY = gridY;
        View.setStartPos(gridX, gridY);
    },
    setEndPos: function (gridX, gridY) {
        this.endX = gridX;
        this.endY = gridY;
        View.setEndPos(gridX, gridY);
    },
    setEndPostwo: function (gridX, gridY) {
        this.endXtwo = gridX;
        this.endYtwo = gridY;
        View.setEndPostwo(gridX, gridY);
    },
    setWalkableAt: function (gridX, gridY, walkable) {
        this.grid.setWalkableAt(gridX, gridY, walkable);
        View.setAttributeAt(gridX, gridY, 'walkable', walkable);
    },
    isStartPos: function (gridX, gridY) {
        return gridX === this.startX && gridY === this.startY;
    },
    isEndPos: function (gridX, gridY) {
        return gridX === this.endX && gridY === this.endY;
    },
    isEndPostwo: function (gridX, gridY) {
        return gridX === this.endXtwo && gridY === this.endYtwo;
    },
    isStartOrEndPos: function (gridX, gridY) {
        return this.isStartPos(gridX, gridY) || this.isEndPos(gridX, gridY);
    },
    isStartOrEndPosOrEndPostwo: function (gridX, gridY) {
        return this.isStartPos(gridX, gridY) || this.isEndPos(gridX, gridY) || this.isEndPostwo(gridX, gridY);//to avoid drawing obstacle over start, end1 and end2 positons on grid.
    },
});
