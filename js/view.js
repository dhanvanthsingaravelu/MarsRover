/**
 * The pathfinding visualization.
 * It uses raphael.js to show the grids.
 */
var View = {
    nodeSize: 40, // width and height of a single node, in pixel
    nodeStyle: {
        normal: {
            fill: 'white',
            'stroke-opacity': 0.2, // the border
        },
        normalimage: {
            'stroke-opacity': 0.2, // the border
        },
        blocked: {
            fill: 'grey',
            'stroke-opacity': 0.2,
        },
        start: {
            fill: '#0d0',
            'stroke-opacity': 0.2,
        },
        end: {
            fill: '#e40',
            'stroke-opacity': 0.2,
        },
        opened: {
            fill: '#98fb98',
            'stroke-opacity': 0.2,
        },
        closed: {
            fill: '#afeeee',
            'stroke-opacity': 0.2,
        },
        failed: {
            fill: '#ff8888',
            'stroke-opacity': 0.2,
        },
        tested: {
            fill: '#e5e5e5',
            'stroke-opacity': 0.2,
        },
    },
    nodeColorizeEffect: {
        duration: 50,
    },
    nodeZoomEffect: {
        duration: 200,
        transform: 's1.2', // scale by 1.2x
        transformBack: 's1.0',
    },
    pathStyle: {
        stroke: '#FF0000',
        'stroke-width': 3,
        'stroke-opacity': "80%"
    },
    supportedOperations: ['opened', 'closed', 'tested'],
    init: function(opts) {
        this.numCols      = opts.numCols;
        this.numRows      = opts.numRows;
        this.paper        = Raphael('draw_area');
        this.$stats       = $('#stats');
    },
    /**
     * Generate the grid asynchronously.
     * This method will be a very expensive task.
     * Therefore, in order to not to block the rendering of browser ui,
     * I decomposed the task into smaller ones. Each will only generate a row.
     */
    generateGrid: function(callback) {
        delete this.paper;
        this.paper = Raphael('draw_area');
        var i, j, x, y,
            rect,
            normalStyle, nodeSize,
            createRowTask, sleep, tasks,
            nodeSize    = this.nodeSize,
            normalStyle = this.nodeStyle.normal,
            numCols     = this.numCols,
            numRows     = this.numRows,
            paper       = this.paper,
            rects       = this.rects = [],
            $stats      = this.$stats;

        paper.setSize(numCols * nodeSize, numRows * nodeSize);

        createRowTask = function(rowId) {
            return function(done) {
                rects[rowId] = [];
                for (j = 0; j < numCols; ++j) {
                    x = j * nodeSize;
                    y = rowId * nodeSize;

                    rect = paper.rect(x, y, nodeSize, nodeSize);
                    rect.attr(normalStyle);
                    rects[rowId].push(rect);
                }
                $stats.text(
                    'generating grid ' +
                    Math.round((rowId + 1) / numRows * 100) + '%'
                );
                done(null);
            };
            
        };

        sleep = function(done) {
            setTimeout(function() {
                done(null);
            }, 0);
        };

        tasks = [];
        for (i = 0; i < numRows; ++i) {
            tasks.push(createRowTask(i));
            tasks.push(sleep);
        }

        async.series(tasks, function() {
            if (callback) {
                callback();
            }
        });
    },
    deleteGrid: function(){
        this.rects=[];
    },
    setStartPos: function(gridX, gridY) {
        var coord = this.toPageCoordinate(gridX, gridY);
        if (!this.startNode) {
            this.startNode = this.paper.image("https://user-images.githubusercontent.com/52419369/87849151-e8709a80-c903-11ea-866c-e0ad7bda78c6.png", coord[0],
             coord[1], 
             this.nodeSize ,
              this.nodeSize );
        } else {
            this.startNode.attr({ x: coord[0], y: coord[1] }).toFront();
            
        }
        this.zoomNode(this.startNode);
    },
    
    setEndPos: function(gridX, gridY) {
        var coord = this.toPageCoordinate(gridX, gridY);
        if (!this.endNode) {
            
            this.endNode = this.paper.image("https://user-images.githubusercontent.com/52419369/87849116-a9dae000-c903-11ea-9e25-aa7f6357a589.png", coord[0],
            coord[1], 
            this.nodeSize ,
             this.nodeSize );
        } else {
            this.endNode.attr({ x: coord[0], y: coord[1] }).toFront();
        }
        this.zoomNode(this.endNode);
    },
    setEndPostwo: function(gridX, gridY) {
        var coord = this.toPageCoordinate(gridX, gridY);
        if (!this.endNodetwo) {
            this.endNodetwo = this.paper.image("https://user-images.githubusercontent.com/52419369/87849116-a9dae000-c903-11ea-9e25-aa7f6357a589.png", coord[0],
            coord[1], 
            this.nodeSize ,
             this.nodeSize );
        } else {
            this.endNodetwo.attr({ x: coord[0], y: coord[1] }).toFront();
        }
        this.zoomNode(this.endNodetwo);
    },
    clearStartEndPos: function() {
        if(this.startNode!=undefined){
            this.startNode.remove();
            delete this.startNode;
        }
        if(this.endNode!=undefined){
            this.endNode.remove();
            delete this.endNode;
        }
        if(this.endNodetwo!=undefined){
            this.endNodetwo.remove();
            delete this.endNodetwo;
        }
    },
   
    /**
     * Set the attribute of the node at the given coordinate.
     */
    setAttributeAt: function(gridX, gridY, attr, value) {
        var color, nodeStyle = this.nodeStyle;
        switch (attr) {
        case 'walkable':
            color = value ? nodeStyle.normal.fill : nodeStyle.blocked.fill;
            this.setWalkableAt(gridX, gridY, value);
            break;
        case 'opened':
            this.colorizeNode(this.rects[gridY][gridX], nodeStyle.opened.fill);
            this.setCoordDirty(gridX, gridY, true);
            break;
        case 'closed':
            this.colorizeNode(this.rects[gridY][gridX], nodeStyle.closed.fill);
            this.setCoordDirty(gridX, gridY, true);
            break;
        case 'tested':
            color = (value === true) ? nodeStyle.tested.fill : nodeStyle.normal.fill;

            this.colorizeNode(this.rects[gridY][gridX], color);
            this.setCoordDirty(gridX, gridY, true);
            break;
        case 'parent':
            // XXX: Maybe draw a line from this node to its parent?
            // This would be expensive.
            break;
        default:
            console.error('unsupported operation: ' + attr + ':' + value);
            return;
        }
    },
    colorizeNode: function(node, color) {
        node.animate({
            fill: color
        }, this.nodeColorizeEffect.duration);
    },
    zoomNode: function(node) {
        node.toFront().attr({
            transform: this.nodeZoomEffect.transform,
        }).animate({
            transform: this.nodeZoomEffect.transformBack,
        }, this.nodeZoomEffect.duration);
    },
    setWalkableAt: function(gridX, gridY, value) {
        var coord = this.toPageCoordinate(gridX, gridY);
        var node, i, blockedNodes = this.blockedNodes;
        if (!blockedNodes) {
            blockedNodes = this.blockedNodes = new Array(this.numRows);
            for (i = 0; i < this.numRows; ++i) {
                blockedNodes[i] = [];
            }
        }
        node = blockedNodes[gridY][gridX];
        if (value) {
            // clear blocked node
            if (node) {
                //var img = this.paper.image("",,this.nodeSize,this.nodeSize);
                //this.colorizeNode(node, this.rects[gridY][gridX].attr('fill'));
                this.zoomNode(node);
                setTimeout(function() {
                    node.remove();
                }, this.nodeZoomEffect.duration);
                blockedNodes[gridY][gridX] = null;
            }
        } else {
            // draw blocked node
            if (node) {
                return;
            }
            node = blockedNodes[gridY][gridX] = this.paper.image("https://user-images.githubusercontent.com/52419369/87849016-f1ad3780-c902-11ea-9961-e10c167964e5.png",coord[0],coord[1],this.nodeSize,this.nodeSize);;
            //this.colorizeNode(node, this.nodeStyle.blocked.fill);
            this.zoomNode(node);
        }
    },
    clearFootprints: function() {
        var i, x, y, coord, coords = this.getDirtyCoords();
        for (i = 0; i < coords.length; ++i) {
            coord = coords[i];
            x = coord[0];
            y = coord[1];
            this.rects[y][x].attr(this.nodeStyle.normal);
            this.setCoordDirty(x, y, false);
        }
    },
    clearBlockedNodes: function() {
        var i, j, blockedNodes = this.blockedNodes;
        if (!blockedNodes) {
            return;
        }
        for (i = 0; i < this.numRows; ++i) {
            for (j = 0 ;j < this.numCols; ++j) {
                if (blockedNodes[i][j]) {
                    blockedNodes[i][j].remove();
                    blockedNodes[i][j] = null;
                }
            }
        }
    },
    drawPath: function(path) {
        if (!path.length) {
            return;
        }
        var svgPath = this.buildSvgPath(path);
        this.path = this.paper.path(svgPath).attr(this.pathStyle);
    },
    /**
     * Given a path, build its SVG represention.
     */
    buildSvgPath: function(path) {
        var i, strs = [], size = this.nodeSize;

        strs.push('M' + (path[0][0] * size + size / 2) + ' ' +
                  (path[0][1] * size + size / 2));
        for (i = 1; i < path.length; ++i) {
            strs.push('L' + (path[i][0] * size + size / 2) + ' ' +
                      (path[i][1] * size + size / 2));
        }

        return strs.join('');
    },
    clearPath: function() {
        if (this.path) {
            this.path.remove();
        }
    },
    /**
     * Helper function to convert the page coordinate to grid coordinate
     */
    toGridCoordinate: function(pageX, pageY) {
        return [
            Math.floor(pageX / this.nodeSize),
            Math.floor(pageY / this.nodeSize)
        ];
    },
    /**
     * helper function to convert the grid coordinate to page coordinate
     */
    toPageCoordinate: function(gridX, gridY) {
        return [
            gridX * this.nodeSize,
            gridY * this.nodeSize
        ];
    },
    showStats: function(opts) {
        var texts = [
            'length: ' + Math.round(opts.pathLength * 100) / 100,
            'time: ' + opts.timeSpent + 'ms',
            'operations: ' + opts.operationCount
        ];
        $('#stats').show().html(texts.join('<br>'));
    },
    setCoordDirty: function(gridX, gridY, isDirty) {
        var x, y,
            numRows = this.numRows,
            numCols = this.numCols,
            coordDirty;

        if (this.coordDirty === undefined) {
            coordDirty = this.coordDirty = [];
            for (y = 0; y < numRows; ++y) {
                coordDirty.push([]);
                for (x = 0; x < numCols; ++x) {
                    coordDirty[y].push(false);
                }
            }
        }

        this.coordDirty[gridY][gridX] = isDirty;
    },
    
    getDirtyCoords: function() {
        var x, y,
            numRows = this.numRows,
            numCols = this.numCols,
            coordDirty = this.coordDirty,
            coords = [];

        if (coordDirty === undefined) {
            return [];
        }

        for (y = 0; y < numRows; ++y) {
            for (x = 0; x < numCols; ++x) {
                if (coordDirty[y][x]) {
                    coords.push([x, y]);
                }
            }
        }
        return coords;
    },
};