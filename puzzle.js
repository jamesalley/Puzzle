YUI.add('puzzle', function(Y) {

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
    // What fraction of a tile's width must be dragged to determine whether it snaps forward (or snaps back)
    Puzzle.SNAP_TOLERANCE = 0.25; // Fraction
    // Difference between gesture start and gesture end. If it's greater than the CLICK_TOLERANCE,
    // it will handle as a drag; if it's less than the CLICK_TOLERANCE, it will handle as a click.
    Puzzle.CLICK_TOLERANCE = 100; // Milliseconds

    // Intial attributes, generally overriden by conf. More ATTRs added during init.
    Puzzle.ATTRS = {
        image: {
            value: 'puzzle.jpg'
        },
        imageDimension: {
            value: 540
        },
        tilesPerSide: {
            value: 4
        }
    };

    Y.extend(Puzzle, Y.Widget, {
                
        initializer: function(conf) {
            this.set('puzzleFrame', this.get('contentBox'));
            this.set('totalTiles', this.get('tilesPerSide')*this.get('tilesPerSide'));
            this.set('tileDimension', this.get('imageDimension')/this.get('tilesPerSide'));
            this.set('frameDimension', this.get('tileDimension')*this.get('tilesPerSide'));
            this.set('dragConstrainer', Node.create(Puzzle.DRAG_CONSTRAINER));
            this.set('dragGroup', Node.create(Puzzle.DRAG_GROUP));
            this.set('rowState', this._initRowState());
            this.set('colState', this._initColState());
            this.set('moveInProgress', false);
            if (this.get('imageDimension') % this.get('tilesPerSide') !== 0 ) {
                this._error('Puzzle: Configuration Error: imageDimension must be evenly divisible by tilesPerSide. Aborting.');
                this.destroy();
            }
        },

        renderUI: function() {
            var puzzleFrame = this.get('puzzleFrame'),
                tileDimension = this.get('tileDimension');

            puzzleFrame.setStyles({
                'width': this.get('frameDimension'),
                'height': this.get('frameDimension')
            });

            var tile,
                bgPos,
                tileCount = 0,
                rowCount = 0;

            // Create and position the requisite tiles.
            for (var i = 0; i < this.get('totalTiles'); i++) {
                tile = Node.create(Puzzle.TILE);
                bgPos = (-1*tileDimension*tileCount) + 'px ' + (-1*tileDimension*rowCount) + 'px';
                tile.setStyles({
                    'width': tileDimension,
                    'height': tileDimension,
                    'backgroundImage': 'url('+this.get('image')+')',
                    'backgroundPosition': bgPos,
                    'top': rowCount*tileDimension,
                    'left': tileCount*tileDimension
                });
                tile.setAttribute('id', 'puzzle-tile-'+i);
                tile.setAttribute('puzzle-tile-id', i);
                tile.setAttribute('row', rowCount);
                tile.setAttribute('col', tileCount);
                puzzleFrame.append(tile);
                tileCount++;
                if (tileCount === this.get('tilesPerSide')) {
                    tileCount = 0;
                    rowCount++;
                }
            }

            // Remove the tile. TO DO: Consider adding this to the config as an option to remove nth-child.
            puzzleFrame.one('.tile').remove();

            // Append the soon-to-be-used dragConstrainer and dragGroup.
            puzzleFrame.append(this.get('dragConstrainer'));
            puzzleFrame.append(this.get('dragGroup'));
        },

        bindUI: function() {
            // A down, drag:start, drag:dragging, drag:end, up, sequence starts on a .tile, but
            // ends with a .dragGroup wrapped around the tile(s).

            var puzzleFrame = this.get('puzzleFrame');
            
            puzzleFrame.delegate('gesturemovestart', Y.bind(this._handleGestureMoveStart, this), ".tile");

            // On iOS and Android the gesturemoveend even is all we need to subscribe to, but on PC it's a little different.
            if (supportsTouch) {
                puzzleFrame.delegate('gesturemoveend', Y.bind(this._handleGestureMoveEnd, this), '.dragGroup');
            }
            else {
                // On PC, this fires after drag sequence:
                Y.DD.DDM.on('drag:end', Y.bind(this._handleGestureMoveEnd, this));
                // And this fires after a simple click:
                Y.DD.DDM.on('drag:mouseup', Y.bind(this._handleGestureMoveEnd, this));
            }

            // set up constrained drag delgation
            var d = new Y.DD.Delegate({
                container: puzzleFrame,
                nodes: '.dragGroup'
            }).dd.plug(Y.Plugin.DDConstrained, {
                constrain2node: this.get('dragConstrainer')
            });
        },

        syncUI: function() {
            // TO DO: Consider setting up ATTRs for all the tiles
            // and then syncUI for all tiles based on the ATTR changes.
        },

        destructor: function() {
            // no external event listeners to clean up
        },

        _error: function(msg) {
            // could be extended to write to the UI, or alert, or whatever.
            if (console) console.log(msg);
        },

        _initRowState: function() {
            // Creates an array of tile ids in their respective positions from a row perspective.
            // Empty slot is null.
            var rowState = [];
            var i = 0,
                count = 0;
            for (i = 0; i < this.get('tilesPerSide'); i++) {
                rowState[i] = [];
                for (var j = 0; j < this.get('tilesPerSide'); j++) {
                    rowState[i][j] = (count) ? count : null;
                    count++;
                }
            }
            return rowState;
        },

        _initColState: function() {
            // Creates an array of tile ids in their respective positions from a col perspective.
            // Empty slot is null.
            var colState = [];
            var i = 0;
            for (i = 0; i < this.get('tilesPerSide'); i++) {
                colState[i] = [];
                for (var j = 0; j < this.get('tilesPerSide'); j++) {
                    colState[i][j] = (!j && !i) ? null : j*this.get('tilesPerSide') + i;
                }
            }
            return colState;
        },

        _handleGestureMoveStart: function(e) {
            // Every gesture start will set up a bunch of ATTRs for our instance based on whether the move is possible or not.
            // We'll use those ATTRs for all the subsequent math.
            if (this.get('moveInProgress')) return;

            this.set('row', e.currentTarget.getAttribute('row'));
            this.set('col', e.currentTarget.getAttribute('col'));
            this.set('emptyRowSlot', this._checkForEmptySlot('row', this.get('row')));
            this.set('emptyColSlot', this._checkForEmptySlot('col', this.get('col')));

            var emptyRowSlot = this.get('emptyRowSlot'),
                emptyColSlot = this.get('emptyColSlot');

            if (emptyRowSlot === false && emptyColSlot === false) {
                this._error('Puzzle: No move possible');
                return;
            }
            // Move is possible, set up a few more values
            this.set('moveInProgress', true);
            this.set('moveIsHorizontal', emptyRowSlot !== false);
            var moveIsHorizontal = this.get('moveIsHorizontal');
            this.set('moveAxis', moveIsHorizontal ? 'x':'y');
            this.set('dragConstrainerMultiple', (moveIsHorizontal) ? (Math.abs(this.get('col')-emptyRowSlot)+1):(Math.abs(this.get('row')-emptyColSlot)+1));
            this.set('dragGroupMultiple', (moveIsHorizontal) ? (Math.abs(this.get('col')-emptyRowSlot)):(Math.abs(this.get('row')-emptyColSlot)));
            this.set('numberOfTilesToMove', this.get('dragGroupMultiple'));
            var moveDirectionBool = (moveIsHorizontal) ? ((this.get('col')-emptyRowSlot) > 0):((this.get('row')-emptyColSlot) > 0);
            this.set('moveDirection', (moveDirectionBool) ? -1 : 1);

            // Now execute some more complicated routines
            this._setUpDragConstrainerAndDragGroup();
            this._moveTilesToDragGroup();
        },

        _handleGestureMoveEnd: function(e) {
            // What's the delta between the dragStart and the dragEnd, as well as the dragDuration?
            var dragDuration = e.endTime - e.startTime,
                dragStartVal = (this.get('moveIsHorizontal')) ? this.get('dragGroupLeftBeforeDrag') : this.get('dragGroupTopBeforeDrag'),
                dragEndVal = (this.get('moveIsHorizontal')) ? this.get('dragGroup').getStyle('left') : this.get('dragGroup').getStyle('top');
            dragStartVal = parseInt(dragStartVal, 10);
            dragEndVal = parseInt(dragEndVal, 10);
            if (Math.abs(dragEndVal - dragStartVal) < this.get('tileDimension')*Puzzle.SNAP_TOLERANCE && dragDuration > Puzzle.CLICK_TOLERANCE) {
                this._snapBack();
            }
            else this._snapForward();
        },

        _snapBack: function() {
            // Pretty simple; just return to original position and do a little clean-up.
            Y.one(this.get('dragGroup')).transition({
                easing: Puzzle.TRANSITION_EASING,
                duration: Puzzle.TRANSITION_DURATION,
                left: this.get('dragGroupLeftBeforeDrag'),
                top: this.get('dragGroupTopBeforeDrag')
            }, Y.bind(this._snapBackCleanup, this));
        },

        _snapBackCleanup: function() {
            this._returnTilesToPuzzleFrame();
            this._resetDragConstrainerAndDragGroup();
            this.set('moveInProgress', false);
        },

        _snapForward: function() {
            // If this.get('moveDirection') is -1, then we want to move to the same left or top value that the empty slot has.
            // If this.get('moveDirection') is +1, then we want to move to the same right or bottom value that the empty slot has.
            var tileDimension = this.get('tileDimension'),
                emptyRowSlot = this.get('emptyRowSlot'),
                emptyColSlot = this.get('emptyColSlot'),
                emptySlotLeft = emptyRowSlot*tileDimension,
                emptySlotTop = emptyColSlot*tileDimension,
                moveDirection = this.get('moveDirection'),
                dragGroupWidth = parseInt(this.get('dragGroup').getStyle('width'), 10),
                dragGroupHeight = parseInt(this.get('dragGroup').getStyle('height'), 10);
            if (moveDirection === -1 && emptyRowSlot > -1 && emptyColSlot === false) {
                // sliding left
                Y.one(this.get('dragGroup')).transition({
                    easing: Puzzle.TRANSITION_EASING,
                    duration: Puzzle.TRANSITION_DURATION,
                    left: emptySlotLeft + 'px'
                }, Y.bind(this._snapForwardCleanup, this));
            }
            else if (moveDirection === 1 && emptyRowSlot > -1 && emptyColSlot === false) {
                // sliding right
                Y.one(this.get('dragGroup')).transition({
                    easing: Puzzle.TRANSITION_EASING,
                    duration: Puzzle.TRANSITION_DURATION,
                    left: (emptySlotLeft - (dragGroupWidth - tileDimension)) + 'px'
                }, Y.bind(this._snapForwardCleanup, this));
            }
            else if (moveDirection === -1 && emptyColSlot > -1) {
                // sliding up
                Y.one(this.get('dragGroup')).transition({
                    easing: Puzzle.TRANSITION_EASING,
                    duration: Puzzle.TRANSITION_DURATION,
                    top: emptySlotTop + 'px'
                }, Y.bind(this._snapForwardCleanup, this));
            }
            else if (moveDirection === 1 && emptyColSlot > -1) {
                // sliding down
                Y.one(this.get('dragGroup')).transition({
                    easing: Puzzle.TRANSITION_EASING,
                    duration: Puzzle.TRANSITION_DURATION,
                    top: (emptySlotTop - (dragGroupHeight - tileDimension)) + 'px'
                }, Y.bind(this._snapForwardCleanup, this));
            }
        },

        _snapForwardCleanup: function() {
            this._updateState();
            this._returnTilesToPuzzleFrame();
            this._resetDragConstrainerAndDragGroup();
            this.set('moveInProgress', false);
        },

        _resetDragConstrainerAndDragGroup: function() {
            this.get('dragConstrainer').setStyles({
                'width': 0,
                'height': 0,
                'left': 0,
                'top': 0
            });
            this.get('dragGroup').setStyles({
                'width': 0,
                'height': 0,
                'left': 0,
                'top': 0
            });
        },

        _setUpDragConstrainerAndDragGroup: function() {
            var tileDimension = this.get('tileDimension');
            if (this.get('moveIsHorizontal')) {
                this.get('dragConstrainer').setStyles({
                    'width': (this.get('dragConstrainerMultiple')*tileDimension),
                    'height': tileDimension,
                    'left': (this.get('moveDirection') === 1) ? (tileDimension*this.get('col')) : (tileDimension*this.get('emptyRowSlot')),
                    'top': (tileDimension*this.get('row'))
                });
                this.get('dragGroup').setStyles({
                    'width': (this.get('dragGroupMultiple')*tileDimension),
                    'height': tileDimension,
                    'left': (this.get('moveDirection') === 1) ? (tileDimension*this.get('col')) : ((tileDimension*this.get('emptyRowSlot')) + tileDimension),
                    'top': (tileDimension*this.get('row'))
                });
            } else {
                this.get('dragConstrainer').setStyles({
                    'width': tileDimension,
                    'height': (this.get('dragConstrainerMultiple')*tileDimension),
                    'left': (tileDimension*this.get('col')),
                    'top': (this.get('moveDirection') === 1) ? (tileDimension*this.get('row')) : (tileDimension*this.get('emptyColSlot'))
                });
                this.get('dragGroup').setStyles({
                    'width': tileDimension,
                    'height': (this.get('dragGroupMultiple')*tileDimension),
                    'left': (tileDimension*this.get('col')),
                    'top': (this.get('moveDirection') === 1) ? (tileDimension*this.get('row')) : ((tileDimension*this.get('emptyColSlot')) + tileDimension)
                });
            }
            this.set('dragGroupLeftBeforeDrag', this.get('dragGroup').getStyle('left'));
            this.set('dragGroupTopBeforeDrag', this.get('dragGroup').getStyle('top'));
        },

        _returnTilesToPuzzleFrame: function() {
            // Look up tile in the newly revised rowState or colState.
            // Update some tile attributes.
            // Return it to the frame.
            // Position it.
            var tile,
                tileId,
                idx;
            while (this.get('dragGroup').hasChildNodes()) {
                tile = this.get('dragGroup').one('.tile');
                tileId = parseInt(tile.getAttribute('puzzle-tile-id'), 10);
                if (this.get('moveIsHorizontal')) {
                    idx = this.get('rowState')[this.get('row')].indexOf(tileId);
                    tile.setAttribute('col', idx);
                }
                else {
                    idx = this.get('colState')[this.get('col')].indexOf(tileId);
                    tile.setAttribute('row', idx);
                }
                this.get('puzzleFrame').append(tile);
                this._setTilePosition(tile, this.get('moveAxis'));
            }
        },

        _moveTilesToDragGroup: function() {
            // Move the tiles out of the puzzle Frame and into the constrained dragGroup
            var i,
                tile;
            if (this.get('moveIsHorizontal')) {
                if (this.get('moveDirection') === -1) {
                    for (i = this.get('col'); i > -1; i--) {
                        tile = this.get('rowState')[this.get('row')][i];
                        if (tile !== null) {
                            this.get('dragGroup').prepend(this.get('puzzleFrame').one('#puzzle-tile-'+tile));
                        }
                        else i = -1; // break
                    }
                } else {
                    for (i = this.get('col'); i < this.get('tilesPerSide'); i++) {
                        tile = this.get('rowState')[this.get('row')][i];
                        if (tile !== null) {
                            this.get('dragGroup').append(this.get('puzzleFrame').one('#puzzle-tile-'+tile));
                        }
                        else i = this.get('tilesPerSide'); // break
                    }
                }
            }
            else { // this.get('moveAxis') === 'y'
                if (this.get('moveDirection') === -1) {
                    for (i = this.get('row'); i > -1; i--) {
                        tile = this.get('colState')[this.get('col')][i];
                        if (tile !== null) {
                            this.get('dragGroup').prepend(this.get('puzzleFrame').one('#puzzle-tile-'+tile));
                        }
                        else i = -1;
                    }
                } else {
                    for (i = this.get('row'); i < this.get('tilesPerSide'); i++) {
                        tile = this.get('colState')[this.get('col')][i];
                        if (tile !== null) {
                            this.get('dragGroup').append(this.get('puzzleFrame').one('#puzzle-tile-'+tile));
                        }
                        else i = this.get('tilesPerSide');
                    }
                }
            }
        },

        _setTilePosition: function(tile, axis) {
            var idx;
            if (axis === 'x') {
                idx = tile.getAttribute('col');
                tile.setStyle('left', idx*this.get('tileDimension'));
            }
            else {
                idx = tile.getAttribute('row');
                tile.setStyle('top', idx*this.get('tileDimension'));
            }
        },

        _updateState: function() {
            // At the end of a move we need to adjust the row or col state as appropriate.
            var i,
                rowState = this.get('rowState'),
                colState = this.get('colState'),
                row = this.get('row'),
                col = this.get('col'),
                tilesPerSide = this.get('tilesPerSide');
            if (this.get('moveIsHorizontal')) {
                // Splice out the empty slot. Start at the emptyRowSlot, and go one space.
                rowState[row].splice(this.get('emptyRowSlot'), 1);
                // Splice it back in to its new position by starting at the position of the
                // selected tile, removing 0 elements, and splicing in null.
                rowState[row].splice(col, 0, null);
                // When a row shifts, we need to update all the columns that intersect it.
                for (i = 0; i < tilesPerSide; i++ ) {
                    colState[i][row] = rowState[row][i];
                }
            }
            else {
                // Scratch that. Reverse it. Move along.
                colState[col].splice(this.get('emptyColSlot'), 1);
                colState[col].splice(row, 0, null);
                for (i = 0; i < tilesPerSide; i++ ) {
                    rowState[i][col] = colState[col][i];
                }
            }
        },
        
        _checkForEmptySlot: function(rowOrCol, whichOne) {
            // When user selects a tile, this returns the value of the row or col
            // where an empty slot exists, otherwise it returns false.
            var i,
                rowState = this.get('rowState'),
                colState = this.get('colState');
            if (rowOrCol === 'row') {
                for (i = 0; i < rowState[whichOne].length; i++) {
                    if (rowState[whichOne][i] === null) return i;
                }
            }
            else {
                for (i = 0; i < colState[whichOne].length; i++) {
                    if (colState[whichOne][i] === null) return i;
                }
            }
            return false;
        }
        
    });

    Y.Puzzle = Puzzle;

}, '1.0.0', {
    requires: ['widget', 'dd-drag', 'dd-delegate', 'dd-constrain', 'event-gestures', 'transition']
});