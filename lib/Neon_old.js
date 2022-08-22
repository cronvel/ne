/*
	Neon

	Copyright (c) 2015 - 2022 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



const termkit = require( 'terminal-kit' ) ;
const TextMachine = require( 'text-machine' ) ;



function Neon( options = {} ) {
	this.term = options.term || termkit.terminal ;
	this.standAlone = !! options.standAlone ;
	this.emptyCellAttr = options.emptyCellAttr || termkit.ScreenBuffer.DEFAULT_ATTR ;
	this.attr = options.attr || termkit.ScreenBuffer.DEFAULT_ATTR ;
	this.pauseMainUserEvent = false ;
	this.fullRedrawNeeded = false ;

	this.hasStatusBar = options.statusBar === undefined ? true : !! options.statusBar ;
	this.statusBarText = '' ;

	this.hasContextBar = options.contextBar === undefined ? true : !! options.contextBar ;
	this.contextBarText = '' ;

	this.filePath = '' ;

	this.keyBindings = defaultKeyBindings ;

	this.scrollContextLines = options.scrollContextLines !== undefined ? options.scrollContextLines : 3 ;
	this.scrollContextColumns = options.scrollContextColumns !== undefined ? options.scrollContextColumns : 10 ;

	this.x = options.x || 1 ;
	this.y = options.y || 1 ;
	this.width = options.width || this.term.width ;
	this.height = options.height || this.term.height ;

	this.statusBarY = this.y ;
	this.contextBarY = this.y + this.height - 1 ;

	this.screenBuffer = new termkit.ScreenBuffer( {
		dst: this.term ,
		x: this.x ,
		y: this.y + ( this.standAlone ? 1 : 0 ) ,
		width: this.width ,
		height: this.height + ( this.standAlone ? -2 : 0 )
	} ) ;

	this.textBuffer = new termkit.TextBuffer( {
		forceInBound: options.forceInBound === undefined ? true : options.forceInBound ,
		dst: this.screenBuffer
	} ) ;

	this.stateMachine = new TextMachine( {
		program: require( 'text-machine/languages/javascript.js' ) ,
		api: termkit.TextBuffer.TextMachineApi
	} ) ;
}

module.exports = Neon ;



Neon.prototype.terminate = function() {
	if ( ! this.standAlone ) { return ; }

	setTimeout( () => {
		//this.term.brightBlack( 'About to exit...\n' ) ;
		this.term.grabInput( false ) ;
		this.term.fullscreen( false ) ;
		this.term.applicationKeypad( false ) ;
		this.term.beep() ;

		// Add a 100ms delay, so the terminal will be ready when the process effectively exit, preventing bad escape sequences drop
		setTimeout( () => { process.exit() ; } , 100 ) ;
	} , 100 ) ;
} ;



Neon.prototype.standAloneInit = function() {
	this.term.fullscreen() ;
} ;



Neon.prototype.run = function() {
	if ( this.standAlone ) { this.standAloneInit() ; }

	this.statusBar( 'Welcome to Neon!' ) ;
	this.contextBar( 'Ctrl-C to quit' ) ;

	this.textBuffer.setEmptyCellAttr( this.emptyCellAttr ) ;
	this.term.grabInput() ;

	// Finish init
	this.draw() ;

	// Bind the 'key' event to the key handler
	this.term.on( 'key' , Neon.prototype.onKey.bind( this ) ) ;

	// Bind the 'terminal' event to the terminal event handler
	this.term.on( 'terminal' , Neon.prototype.onTerminal.bind( this ) ) ;
} ;



Neon.prototype.openFile = async function( path ) {
	this.pauseMainUserEvent = true ;

	try {
		await this.textBuffer.load( path ) ;
	}
	finally {
		this.pauseMainUserEvent = false ;
	}

	this.filePath = path ;
	this.runStateMachine() ;
	this.draw() ;
} ;



Neon.prototype.saveFile = async function( path ) {
	this.pauseMainUserEvent = true ;

	try {
		await this.textBuffer.save( path ) ;
	}
	finally {
		this.pauseMainUserEvent = false ;
	}

	this.filePath = path ;
} ;



Neon.prototype.open = async function() {
	var filePath , options ;

	this.pauseMainUserEvent = true ;

	// Leave room for the singleLineMenu
	//this.term.moveTo( this.x , this.y + this.height - 2 ).bgWhite.blue.eraseLine( 'Save to: ' ) ;
	this.contextBar( 'Open: ' , { cursor: false } ) ;

	options = {
		cancelable: true ,
		style: this.term.bgWhite.blue
	} ;

	try {
		filePath = await this.term.fileInput( options ) ;
	}
	finally {
		this.pauseMainUserEvent = false ;
		this.fullRedrawNeeded = true ;	// Because of eventual singleLineMenu() scrolling
		this.draw() ;
	}

	if ( ! filePath ) {
		// Aborted by user
		this.contextBar( 'Ok then...' , { timeout: 2000 } ) ;
		return ;
	}

	try {
		await this.openFile( filePath ) ;
	}
	catch ( error ) {
		this.contextBar( 'Failed to load: ' + error.toString() ) ;
		throw error ;
	}

	this.contextBar( 'Loaded!' , { timeout: 2000 } ) ;
	this.draw() ;
} ;



Neon.prototype.save = async function() {
	var filePath , options ;

	this.pauseMainUserEvent = true ;

	// Leave room for the singleLineMenu
	//this.term.moveTo( this.x , this.y + this.height - 2 ).bgWhite.blue.eraseLine( 'Save to: ' ) ;
	this.contextBar( 'Save to: ' , { cursor: false } ) ;

	options = {
		cancelable: true ,
		default: this.filePath ,
		style: this.term.bgWhite.blue
	} ;

	try {
		filePath = await this.term.fileInput( options ) ;
	}
	finally {
		this.pauseMainUserEvent = false ;
		this.fullRedrawNeeded = true ;	// Because of eventual singleLineMenu() scrolling
		this.draw() ;
	}

	if ( ! filePath ) {
		// Aborted by user
		this.contextBar( 'Ok then...' , { timeout: 2000 } ) ;
		return ;
	}

	try {
		await this.saveFile( filePath ) ;
	}
	catch ( error ) {
		this.contextBar( 'Failed to save: ' + error.toString() ) ;
		throw error ;
	}

	this.contextBar( 'Saved!' , { timeout: 2000 } ) ;
} ;



Neon.prototype.onKey = function( key , matches , data ) {
	if ( data.isCharacter ) {
		// User interactions are disabled (file loading, etc), so return now!
		if ( this.pauseMainUserEvent ) { return ; }

		this.textBuffer.insert( key , this.attr ) ;
		this.runStateMachine() ;
		this.cursorHint() ;
		if ( ! this.followCursor() ) { this.draw() ; }
	}
	else if ( this.keyBindings[ key ] ) {
		// User interactions are disabled (file loading, etc), except the 'terminate' action
		if ( this.pauseMainUserEvent && this.keyBindings[ key ] !== 'terminate' ) { return ; }

		Neon.userAction[ this.keyBindings[ key ] ].call( this ) ;
	}
} ;



Neon.prototype.cursorHint = function() {
	var misc ;

	if ( this.textBuffer.cx ) {
		misc = this.textBuffer.getMiscAt( this.textBuffer.cx - 1 , this.textBuffer.cy ) ;
	}

	this.contextBar( misc && misc.hint , { hint: true } ) ;
} ;



Neon.prototype.onTerminal = function( name , data ) {
	if ( name === 'SCREEN_RESIZE' && this.standAlone ) {
		this.resize( data.width , data.height ) ;
	}
} ;



Neon.prototype.runStateMachine = function() {
	if ( ! this.stateMachine ) { return ; }

	this.stateMachine.reset() ;

	this.textBuffer.iterate( { finalCall: true } , context => {
		context.textBuffer = this.textBuffer ;
		this.stateMachine.pushEvent( context.text , context ) ;
	} ) ;
} ;



Neon.prototype.draw = function( omitCursor ) {
	this.textBuffer.draw() ;
	this.screenBuffer.draw( { delta: ! this.fullRedrawNeeded } ) ;

	// Draw the cursor, i.e. move it on screen where the textBuffer cursor is
	if ( ! omitCursor ) {
		this.textBuffer.drawCursor() ;
		this.screenBuffer.drawCursor() ;
	}

	if ( this.fullRedrawNeeded ) {
		this.statusBar() ;
		this.contextBar() ;
	}

	this.fullRedrawNeeded = false ;
} ;



// Draw the cursor, i.e. move it on screen where the textBuffer cursor is
Neon.prototype.drawCursor = function() {
	this.textBuffer.drawCursor() ;
	this.screenBuffer.drawCursor() ;
} ;



Neon.prototype.statusBar = function( str ) {
	if ( ! this.hasStatusBar ) { return ; }

	if ( typeof str !== 'string' ) { str = this.statusBarText ; }
	else { this.statusBarText = str ; }

	this.term.moveTo( this.x , this.statusBarY ).styleReset.bgWhite.blue.eraseLine( str ) ;

	this.drawCursor() ;
} ;



Neon.prototype.contextBar = function( str , options ) {
	if ( ! this.hasContextBar ) { return ; }

	options = options || {} ;

	if ( this.contextBarTimer ) {
		clearTimeout( this.contextBarTimer ) ;
		this.contextBarTimer = null ;
	}

	if ( options.hint ) { this.contextBarIsHint = true ; }

	if ( typeof str !== 'string' ) {
		if ( options.hint && this.contextBarIsHint ) { str = '' ; }
		else { str = this.contextBarText ; }

		this.contextBarIsHint = false ;
	}
	else {
		this.contextBarText = str ;

		if ( options.hint ) { this.contextBarIsHint = true ; }
		else { this.contextBarIsHint = false ; }
	}

	this.term.moveTo( this.x , this.contextBarY ).styleReset.bgWhite.blue.eraseLine( str ) ;

	if ( ! ( 'cursor' in options ) || options.cursor ) { this.drawCursor() ; }

	if ( options.timeout ) {
		this.contextBarTimer = setTimeout( () => this.contextBar( '' ) , options.timeout ) ;
	}
} ;



Neon.prototype.fullRedraw = function() {
	this.fullRedrawNeeded = true ;
	this.draw() ;
	this.statusBar() ;
	this.contextBar() ;
} ;



Neon.prototype.resize = function( width , height ) {
	this.width = width ;
	this.height = height ;

	this.screenBuffer.resize( {
		x: 0 ,
		y: 0 ,
		width: width ,
		height: height - 2
	} ) ;

	this.contextBarY = this.y + this.height - 1 ;

	this.followCursor() ;
	this.fullRedraw() ;
} ;





Neon.prototype.followCursor = function() {
	var oldX = this.textBuffer.x ,
		oldY = this.textBuffer.y ,
		scrollContextLines = Math.min( this.scrollContextLines , Math.floor( ( this.screenBuffer.height - 1 ) / 2 ) ) ,
		scrollContextColumns = Math.min( this.scrollContextColumns , Math.floor( ( this.screenBuffer.width - 1 ) / 2 ) ) ;

	if ( this.textBuffer.x < -this.textBuffer.cx + scrollContextColumns ) {
		this.textBuffer.x = Math.min( 0 , -this.textBuffer.cx + scrollContextColumns ) ;
	}
	else if ( this.textBuffer.x > -this.textBuffer.cx + this.screenBuffer.width - scrollContextColumns - 1 ) {
		this.textBuffer.x = -this.textBuffer.cx + this.screenBuffer.width - scrollContextColumns - 1 ;
	}

	if ( this.textBuffer.y < -this.textBuffer.cy + scrollContextLines ) {
		this.textBuffer.y = Math.min( 0 , -this.textBuffer.cy + scrollContextLines ) ;
	}
	else if ( this.textBuffer.y > -this.textBuffer.cy + this.screenBuffer.height - scrollContextLines - 1 ) {
		this.textBuffer.y = -this.textBuffer.cy + this.screenBuffer.height - scrollContextLines - 1 ;
	}

	if ( this.textBuffer.x !== oldX || this.textBuffer.y !== oldY ) {
		this.draw() ;
		return true ;
	}

	return false ;
} ;





/* Binding and user actions */



var defaultKeyBindings = {
	UP: 'up' ,
	DOWN: 'down' ,
	LEFT: 'backward' ,
	RIGHT: 'forward' ,
	END: 'endOfLine' ,
	HOME: 'startOfLine' ,
	ENTER: 'newLine' ,
	DELETE: 'delete' ,
	BACKSPACE: 'backDelete' ,
	TAB: 'tab' ,
	PAGE_UP: 'halfPageUp' ,
	PAGE_DOWN: 'halfPageDown' ,
	CTRL_X: 'save' ,
	CTRL_O: 'open' ,
	CTRL_C: 'terminate' ,
	CTRL_R: 'redraw'
} ;

Neon.userAction = {} ;

Neon.userAction.up = function() {
	this.textBuffer.moveUp() ;
	this.cursorHint() ;
	if ( ! this.followCursor() ) { this.drawCursor() ; }
} ;



Neon.userAction.down = function() {
	this.textBuffer.moveDown() ;
	this.cursorHint() ;
	if ( ! this.followCursor() ) { this.drawCursor() ; }
} ;



Neon.userAction.backward = function() {
	this.textBuffer.moveBackward() ;
	this.cursorHint() ;
	if ( ! this.followCursor() ) { this.drawCursor() ; }
} ;



Neon.userAction.forward = function() {
	this.textBuffer.moveForward() ;
	this.cursorHint() ;
	if ( ! this.followCursor() ) { this.drawCursor() ; }
} ;



Neon.userAction.endOfLine = function() {
	this.textBuffer.moveToEndOfLine() ;
	this.cursorHint() ;
	if ( ! this.followCursor() ) { this.drawCursor() ; }
} ;



Neon.userAction.startOfLine = function() {
	this.textBuffer.moveToColumn( 0 ) ;
	this.cursorHint() ;
	if ( ! this.followCursor() ) { this.drawCursor() ; }
} ;



Neon.userAction.newLine = function() {
	this.textBuffer.newLine() ;
	this.runStateMachine() ;
	this.cursorHint() ;
	if ( ! this.followCursor() ) { this.draw() ; }
} ;



Neon.userAction.delete = function() {
	this.textBuffer.delete( 1 ) ;
	this.runStateMachine() ;
	this.cursorHint() ;
	this.draw() ;
} ;



Neon.userAction.backDelete = function() {
	this.textBuffer.backDelete( 1 ) ;
	this.runStateMachine() ;
	this.cursorHint() ;
	if ( ! this.followCursor() ) { this.draw() ; }
} ;



Neon.userAction.tab = function() {
	this.textBuffer.insert( '\t' ) ;
	this.runStateMachine() ;
	this.cursorHint() ;
	if ( ! this.followCursor() ) { this.draw() ; }
} ;



Neon.userAction.halfPageUp = function() {
	var delta = -Math.ceil( this.screenBuffer.height / 2 ) ;

	this.textBuffer.y = Math.min(
		0 ,
		this.textBuffer.y - delta
	) ;

	this.textBuffer.move( 0 , delta ) ;
	this.cursorHint() ;
	if ( ! this.followCursor() ) { this.draw() ; }
} ;



Neon.userAction.halfPageDown = function() {
	var delta = Math.ceil( this.screenBuffer.height / 2 ) ;

	this.textBuffer.y = Math.max(
		-this.textBuffer.buffer.length + delta ,
		this.textBuffer.y - delta
	) ;

	this.textBuffer.move( 0 , delta ) ;
	if ( this.textBuffer.cy > this.textBuffer.buffer.length ) { this.textBuffer.cy = this.textBuffer.buffer.length ; }
	this.cursorHint() ;
	if ( ! this.followCursor() ) { this.draw() ; }
} ;



Neon.userAction.save = function() {
	this.save() ;
} ;



Neon.userAction.open = function() {
	this.open() ;
} ;



Neon.userAction.terminate = function() {
	this.terminate() ;
} ;



Neon.userAction.redraw = function() {
	this.fullRedraw() ;
} ;

