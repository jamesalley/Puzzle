YUI.add('puzzle', function(Y) {

    var Node = Y.Node,
        supportsTouch = 'ontouchstart' in Y.config.win;

    function Puzzle(config) {
        Puzzle.superclass.constructor.apply(this, arguments);
    }

    Puzzle.NAME = 'puzzle';
    Puzzle.NS = 'puzzle';
    Puzzle.TILE = '<div class="tile">tile</div>';
    Puzzle.FRAME = '<div class="puzzle-frame">Puzzle frame</div>';
    Puzzle.DRAG_CONSTRAINER = '<div class="dragConstrainer"></div>';
    Puzzle.DRAG_GROUP = '<div class="dragGroup"></div>';
    Puzzle.TRANSITION_DURATION = 0.25;
    Puzzle.TRANSITION_EASING = 'ease-out';
    Puzzle.SNAP_TOLERANCE = 0.25; // what fraction of tileDimension to drag to avoid snapBack
    Puzzle.ATTRS = {
    };

    // Array.indexOf shim for IE
    if (!Array.indexOf) {
        Array.prototype.indexOf = function(obj) {
            for (var i = 0; i < this.length; i++) {
                if (this[i] == obj) {
                    return i;
                }
            }
            return -1;
        };
    }
    
    Y.extend(Puzzle, Y.Widget, {
                
        initializer: function(conf) {
            this.container = Y.one(conf.container);
            this.tilesPerSide = conf.tilesPerSide;
            this.totalTiles = (conf.tilesPerSide*conf.tilesPerSide);
            this.image = conf.image;
            this.imageDimension = conf.imageDimension;
            this.tileDimension = (this.imageDimension/this.tilesPerSide);
            this.frameDimension = this.tileDimension*this.tilesPerSide;
            this.dragConstrainer = Node.create(Puzzle.DRAG_CONSTRAINER);
            this.dragGroup = Node.create(Puzzle.DRAG_GROUP);
            this.rowState = this._initRowState();
            this.colState = this._initColState();
            this.moveInProgress = false;
            if (this.imageDimension % this.tilesPerSide !== 0 ) {
                if (console) console.log('Puzzle: Configuration Error: imageDimension must be evenly divisible by tilesPerSide. Aborting.');
                this.destroy();
            }
        },

        renderUI: function() {
            this.puzzleFrame = this.get('contentBox');
            this.puzzleFrame.setStyles({
                'width': this.frameDimension,
                'height': this.frameDimension
            });
            var tile,
                bgPos,
                tileCount = 0,
                rowCount = 0;
            // Create and position the requisite tiles.
            for (var i = 0; i < this.totalTiles; i++) {
                tile = Node.create(Puzzle.TILE);
                bgPos = (-1*this.tileDimension*tileCount) + 'px ' + (-1*this.tileDimension*rowCount) + 'px';
                tile.setStyles({
                    'width': this.tileDimension,
                    'height': this.tileDimension,
                    'backgroundImage': 'url('+this.image+')',
                    'backgroundPosition': bgPos,
                    'top': rowCount*this.tileDimension,
                    'left': tileCount*this.tileDimension
                });
                tile.setAttribute('id', 'puzzle-tile-'+i);
                tile.setAttribute('puzzle-tile-id', i);
                tile.setAttribute('row', rowCount);
                tile.setAttribute('col', tileCount);
                this.puzzleFrame.append(tile);
                tileCount++;
                if (tileCount === this.tilesPerSide) {
                    tileCount = 0;
                    rowCount++;
                }
            }
            // Remove the tile. TO DO: Consider adding this to the config as an option to remove nth-child.
            this.puzzleFrame.one('.tile').remove();
            // Append the soon-to-be-used dragConstrainer and dragGroup.
            this.puzzleFrame.append(this.dragConstrainer);
            this.puzzleFrame.append(this.dragGroup);
        },

        bindUI: function() {
            // A down, drag:start, drag:dragging, drag:end, up, sequence starts on a .tile, but
            // ends with a .dragGroup wrapped around the tile(s).
            this.puzzleFrame.delegate('gesturemovestart', Y.bind(this._handleGestureMoveStart, this), ".tile");
            // On iOS and Android the gesturemoveend even is all we need to subscribe to, but on PC it's a little different.
            if (supportsTouch) {
                this.puzzleFrame.delegate('gesturemoveend', Y.bind(this._handleGestureMoveEnd, this), '.dragGroup');
            }
            else {
                // On PC, this fires after drag sequence:
                Y.DD.DDM.on('drag:end', Y.bind(this._handleGestureMoveEnd, this));
                // And this fires after a simple click:
                Y.DD.DDM.on('drag:mouseup', Y.bind(this._handleGestureMoveEnd, this));
            }
            // set up constrained drag delgation
            this.delegate = new Y.DD.Delegate({
                container: this.puzzleFrame,
                nodes: '.dragGroup'
            });
            this.delegate.dd.plug(Y.Plugin.DDConstrained, {
                constrain2node: this.dragConstrainer
            });
        },

        syncUI: function() {
            // TO DO: Consider setting up ATTRs for all the tiles
            // and then syncUI for all tiles based on the ATTR changes.
        },

        destructor: function() {
            // no external event listeners to clean up
        },

        _initRowState: function() {
            // Creates a grid of tile ids in their respective positions from a row perspective.
            // Empty slot is null.
            var rowState = [];
            var i = 0,
                count = 0;
            for (i = 0; i < this.tilesPerSide; i++) {
                rowState[i] = [];
                for (var j = 0; j < this.tilesPerSide; j++) {
                    rowState[i][j] = (count) ? count : null;
                    count++;
                }
            }
            return rowState;
        },

        _initColState: function() {
            // Creates a grid of tile ids in their respective positions from a col perspective.
            // Empty slot is null.
            var colState = [];
            var i = 0;
            for (i = 0; i < this.tilesPerSide; i++) {
                colState[i] = [];
                for (var j = 0; j < this.tilesPerSide; j++) {
                    colState[i][j] = (!j && !i) ? null : j*this.tilesPerSide + i;
                }
            }
            return colState;
        },

        _handleGestureMoveStart: function(e) {
            if (this.moveInProgress) return;
            this.tileId = e.currentTarget.getAttribute('puzzle-tile-id');
            this.row = e.currentTarget.getAttribute('row');
            this.col = e.currentTarget.getAttribute('col');
            this.emptyRowSlot = this._checkForEmptySlot('row', this.row);
            this.emptyColSlot = this._checkForEmptySlot('col', this.col);
            if (this.emptyRowSlot === false && this.emptyColSlot === false) {
                if (console) console.log('No move possible');
                return;
            }
            this.moveIsHorizontal = (this.emptyRowSlot !== false);
            this.moveAxis = (this.moveIsHorizontal) ? 'x':'y';
            this.dragConstrainerMultiple = (this.moveIsHorizontal) ? (Math.abs(this.col-this.emptyRowSlot)+1):(Math.abs(this.row-this.emptyColSlot)+1);
            this.dragGroupMultiple = (this.moveIsHorizontal) ? (Math.abs(this.col-this.emptyRowSlot)):(Math.abs(this.row-this.emptyColSlot));
            this.numberOfTilesToMove = this.dragGroupMultiple;
            this.moveDirectionBool = (this.moveIsHorizontal) ? ((this.col-this.emptyRowSlot) > 0):((this.row-this.emptyColSlot) > 0);
            this.moveDirection = (this.moveDirectionBool) ? -1 : 1;
            this._setUpDragConstrainerAndDragGroup();
            this._moveTilesToDragGroup();
        },

        _handleGestureMoveEnd: function(e) {
            // What's the delta between the dragStart and the dragEnd?
            var dragStartVal = (this.moveIsHorizontal) ? this.dragGroupLeftBeforeDrag : this.dragGroupTopBeforeDrag,
                dragEndVal = (this.moveIsHorizontal) ? this.dragGroup.getStyle('left') : this.dragGroup.getStyle('top');
            dragStartVal = parseInt(dragStartVal, 10);
            dragEndVal = parseInt(dragEndVal, 10);
            if (Math.abs(dragEndVal - dragStartVal) < this.tileDimension*Puzzle.SNAP_TOLERANCE) {
                this._snapBack();
            }
            else this._snapForward();
        },

        _snapBack: function() {
            // Pretty simple; just return to original position and do a little clean-up.
            Y.one(this.dragGroup).transition({
                easing: Puzzle.TRANSITION_EASING,
                duration: Puzzle.TRANSITION_DURATION,
                left: this.dragGroupLeftBeforeDrag,
                top: this.dragGroupTopBeforeDrag
            }, Y.bind(this._snapBackCleanup, this));
        },

        _snapBackCleanup: function() {
            this._returnTilesToPuzzleFrame();
            this._resetDragConstrainerAndDragGroup();
            this.moveInProgress = false;
        },

        _snapForward: function() {
            // If this.moveDirection is -1, then we want to move to the same left or top value that the empty slot has.
            // If this.moveDirection is +1, then we want to move to the same right or bottom value that the empty slot has.
            var emptySlotLeft = this.emptyRowSlot*this.tileDimension,
                emptySlotTop = this.emptyColSlot*this.tileDimension,
                dragGroupWidth = parseInt(this.dragGroup.getStyle('width'), 10),
                dragGroupHeight = parseInt(this.dragGroup.getStyle('height'), 10);
            if (this.moveDirection === -1 && this.emptyRowSlot > -1 && this.emptyColSlot === false) {
                // sliding left
                Y.one(this.dragGroup).transition({
                    easing: Puzzle.TRANSITION_EASING,
                    duration: Puzzle.TRANSITION_DURATION,
                    left: emptySlotLeft + 'px'
                }, Y.bind(this._snapForwardCleanup, this));
            }
            else if (this.moveDirection === 1 && this.emptyRowSlot > -1 && this.emptyColSlot === false) {
                // sliding right
                Y.one(this.dragGroup).transition({
                    easing: Puzzle.TRANSITION_EASING,
                    duration: Puzzle.TRANSITION_DURATION,
                    left: (emptySlotLeft - (dragGroupWidth - this.tileDimension)) + 'px'
                }, Y.bind(this._snapForwardCleanup, this));
            }
            else if (this.moveDirection === -1 && this.emptyColSlot > -1) {
                // sliding up
                Y.one(this.dragGroup).transition({
                    easing: Puzzle.TRANSITION_EASING,
                    duration: Puzzle.TRANSITION_DURATION,
                    top: emptySlotTop + 'px'
                }, Y.bind(this._snapForwardCleanup, this));
            }
            else if (this.moveDirection === 1 && this.emptyColSlot > -1) {
                // sliding down
                Y.one(this.dragGroup).transition({
                    easing: Puzzle.TRANSITION_EASING,
                    duration: Puzzle.TRANSITION_DURATION,
                    top: (emptySlotTop - (dragGroupHeight - this.tileDimension)) + 'px'
                }, Y.bind(this._snapForwardCleanup, this));
            }
        },

        _snapForwardCleanup: function() {
            this._updateState();
            this._returnTilesToPuzzleFrame();
            this._resetDragConstrainerAndDragGroup();
            this.moveInProgress = false;
        },

        _resetDragConstrainerAndDragGroup: function() {
            this.dragConstrainer.setStyles({
                'width': 0,
                'height': 0,
                'left': 0,
                'top': 0
            });
            this.dragGroup.setStyles({
                'width': 0,
                'height': 0,
                'left': 0,
                'top': 0
            });
        },

        _setUpDragConstrainerAndDragGroup: function() {
            if (this.moveIsHorizontal) {
                this.dragConstrainer.setStyles({
                    'width': (this.dragConstrainerMultiple*this.tileDimension),
                    'height': this.tileDimension,
                    'left': (this.moveDirection === 1) ? (this.tileDimension*this.col) : (this.tileDimension*this.emptyRowSlot),
                    'top': (this.tileDimension*this.row)
                });
                this.dragGroup.setStyles({
                    'width': (this.dragGroupMultiple*this.tileDimension),
                    'height': this.tileDimension,
                    'left': (this.moveDirection === 1) ? (this.tileDimension*this.col) : ((this.tileDimension*this.emptyRowSlot) + this.tileDimension),
                    'top': (this.tileDimension*this.row)
                });
            } else {
                this.dragConstrainer.setStyles({
                    'width': this.tileDimension,
                    'height': (this.dragConstrainerMultiple*this.tileDimension),
                    'left': (this.tileDimension*this.col),
                    'top': (this.moveDirection === 1) ? (this.tileDimension*this.row) : (this.tileDimension*this.emptyColSlot)
                });
                this.dragGroup.setStyles({
                    'width': this.tileDimension,
                    'height': (this.dragGroupMultiple*this.tileDimension),
                    'left': (this.tileDimension*this.col),
                    'top': (this.moveDirection === 1) ? (this.tileDimension*this.row) : ((this.tileDimension*this.emptyColSlot) + this.tileDimension)
                });
            }
            this.dragGroupLeftBeforeDrag = this.dragGroup.getStyle('left');
            this.dragGroupTopBeforeDrag = this.dragGroup.getStyle('top');
        },

        _returnTilesToPuzzleFrame: function() {
            // Look up tile in the newly revised rowState or colState.
            // Update some tile attributes.
            // Return it to the frame.
            // Position it.
            var tile,
                tileId,
                idx;
            while (this.dragGroup.hasChildNodes()) {
                tile = this.dragGroup.one('.tile');
                tileId = parseInt(tile.getAttribute('puzzle-tile-id'), 10);
                if (this.moveIsHorizontal) {
                    idx = this.rowState[this.row].indexOf(tileId);
                    tile.setAttribute('col', idx);
                }
                else {
                    idx = this.colState[this.col].indexOf(tileId);
                    tile.setAttribute('row', idx);
                }
                this.puzzleFrame.append(tile);
                this._setTilePosition(tile, this.moveAxis);
            }
        },

        _moveTilesToDragGroup: function() {
            // Move the tiles out of the puzzle Frame and into the constrained dragGroup
            var i,
                tile;
            if (this.moveIsHorizontal) {
                if (this.moveDirection === -1) {
                    for (i = this.col; i > -1; i--) {
                        tile = this.rowState[this.row][i];
                        if (tile !== null) {
                            this.dragGroup.prepend(this.puzzleFrame.one('#puzzle-tile-'+tile));
                        }
                        else i = -1; // break
                    }
                } else {
                    for (i = this.col; i < this.tilesPerSide; i++) {
                        tile = this.rowState[this.row][i];
                        if (tile !== null) {
                            this.dragGroup.append(this.puzzleFrame.one('#puzzle-tile-'+tile));
                        }
                        else i = this.tilesPerSide; // break
                    }
                }
            }
            else { // this.moveAxis === 'y'
                if (this.moveDirection === -1) {
                    for (i = this.row; i > -1; i--) {
                        tile = this.colState[this.col][i];
                        if (tile !== null) {
                            this.dragGroup.prepend(this.puzzleFrame.one('#puzzle-tile-'+tile));
                        }
                        else i = -1;
                    }
                } else {
                    for (i = this.row; i < this.tilesPerSide; i++) {
                        tile = this.colState[this.col][i];
                        if (tile !== null) {
                            this.dragGroup.append(this.puzzleFrame.one('#puzzle-tile-'+tile));
                        }
                        else i = this.tilesPerSide;
                    }
                }
            }
        },

        _setTilePosition: function(tile, axis) {
            var idx;
            if (axis === 'x') {
                idx = tile.getAttribute('col');
                tile.setStyle('left', idx*this.tileDimension);
            }
            else {
                idx = tile.getAttribute('row');
                tile.setStyle('top', idx*this.tileDimension);
            }
        },

        _updateState: function() {
            // At the end of a move we need to adjust the row or col state as appropriate.
            var i;
            if (this.moveIsHorizontal) {
                // Splice out the empty slot. Start at the emptyRowSlot, and go one space.
                this.rowState[this.row].splice(this.emptyRowSlot, 1);
                // Splice it back in to its new position by starting at the position of the
                // selected tile, removing 0 elements, and splicing in null.
                this.rowState[this.row].splice(this.col, 0, null);
                // When a row shifts, we need to update all the columns that intersect it.
                for (i = 0; i < this.tilesPerSide; i++ ) {
                    this.colState[i][this.row] = this.rowState[this.row][i];
                }
            }
            else {
                // Scratch that. Reverse it. Move along.
                this.colState[this.col].splice(this.emptyColSlot, 1);
                this.colState[this.col].splice(this.row, 0, null);
                for (i = 0; i < this.tilesPerSide; i++ ) {
                    this.rowState[i][this.col] = this.colState[this.col][i];
                }
            }
        },
        
        _checkForEmptySlot: function(rowOrCol, whichOne) {
            // When user selects a tile, this returns the value of the row or col
            // where an empty slot exists, otherwise it returns false.
            var i;
            if (rowOrCol === 'row') {
                for (i = 0; i < this.rowState[whichOne].length; i++) {
                    if (this.rowState[whichOne][i] === null) return i;
                }
            }
            else {
                for (i = 0; i < this.colState[whichOne].length; i++) {
                    if (this.colState[whichOne][i] === null) return i;
                }
            }
            return false;
        }
        
    });

    Y.Puzzle = Puzzle;

}, '1.0.0', {
    requires: ['widget', 'dd-drag', 'dd-delegate', 'dd-constrain', 'event-gestures', 'transition']
});