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



/*
	This is a third-party Terminal-Kit document widget.
*/



const termkit = require( 'terminal-kit' ) ;
const Element = termkit.Element ;
const EditableTextBox = termkit.EditableTextBox ;
const TextBox = termkit.TextBox ;
const Text = termkit.Text ;



function TextEditor( options = {} ) {
	// Clone options if necessary
    options = ! options ? {} : options.internal ? options : Object.create( options ) ;
    options.internal = true ;

    Element.call( this , options ) ;

	this.editableTextBox = null ;
	this.statusBar = null ;
	this.contextBar = null ;
	
	
	
	
	this.hasStatusBar = options.statusBar === undefined ? true : !! options.statusBar ;
	this.statusBarText = '' ;

	this.hasContextBar = options.contextBar === undefined ? true : !! options.contextBar ;
	this.contextBarText = '' ;

	this.filePath = '' ;

	this.keyBindings = defaultKeyBindings ;

	this.scrollContextLines = options.scrollContextLines !== undefined ? options.scrollContextLines : 3 ;
	this.scrollContextColumns = options.scrollContextColumns !== undefined ? options.scrollContextColumns : 10 ;

	this.statusBarY = this.y ;
	this.contextBarY = this.y + this.height - 1 ;

	this.stateMachine = new ne.StateMachine( {
		program: require( 'text-machine/languages/javascript.js' ) ,
		api: termkit.TextBuffer.TextMachineApi
	} ) ;
	
	// Only draw if we are not a superclass of the object
    if ( this.elementType === 'TextEditor' && ! options.noDraw ) { this.draw() ; }
}

module.exports = TextEditor ;

TextEditor.prototype = Object.create( Element.prototype ) ;
TextEditor.prototype.constructor = TextEditor ;
TextEditor.prototype.elementType = 'TextEditor' ;

TextEditor.prototype.needInput = true ;



TextEditor.prototype.destroy = function( isSubDestroy , noDraw = false ) {
	if ( this.destroyed ) { return ; }

	//this.off( 'key' , this.onKey ) ;

	Element.prototype.destroy.call( this , isSubDestroy , noDraw ) ;
} ;



TextEditor.prototype.keyBindings = {
	/*
	ENTER: 'newLine' ,
	KP_ENTER: 'newLine' ,
	BACKSPACE: 'backDelete' ,
	DELETE: 'delete' ,
	LEFT: 'backward' ,
	RIGHT: 'forward' ,
	CTRL_LEFT: 'startOfWord' ,
	CTRL_RIGHT: 'endOfWord' ,
	UP: 'up' ,
	DOWN: 'down' ,
	HOME: 'startOfLine' ,
	END: 'endOfLine' ,
	TAB: 'tab' ,
	PAGE_UP: 'scrollUp' ,
	PAGE_DOWN: 'scrollDown' ,
	CTRL_O: 'copyClipboard' ,
	CTRL_P: 'pasteClipboard'
	*/
} ;



//TextEditor.prototype.drawSelfCursor = function() { this.textBuffer.drawCursor() ; } ;



TextEditor.prototype.getValue = TextBox.prototype.getContent = function() {
	return this.editableTextBox.getContent() ;
} ;



TextEditor.prototype.setValue = function( value , dontDraw ) {
    return this.editableTextBox.setValue( value , dontDraw ) ;
} ;



TextEditor.prototype.initChildren = function() {
	this.editableTextBox = new EditableTextBox( {
	} ) ;
	this.statusBar = new Text( {
	} ) ;
	this.contextBar = new Text( {
	} ) ;
} ;











TextEditor.prototype.openFile = async function( path ) {
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



TextEditor.prototype.saveFile = async function( path ) {
	this.pauseMainUserEvent = true ;

	try {
		await this.textBuffer.save( path ) ;
	}
	finally {
		this.pauseMainUserEvent = false ;
	}

	this.filePath = path ;
} ;



TextEditor.prototype.open = async function() {
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



TextEditor.prototype.save = async function() {
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



TextEditor.prototype.onKey = function( key , matches , data ) {
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

		TextEditor.userAction[ this.keyBindings[ key ] ].call( this ) ;
	}
} ;



TextEditor.prototype.cursorHint = function() {
	var misc ;

	if ( this.textBuffer.cx ) {
		misc = this.textBuffer.getMiscAt( this.textBuffer.cx - 1 , this.textBuffer.cy ) ;
	}

	this.contextBar( misc && misc.hint , { hint: true } ) ;
} ;



TextEditor.prototype.onTerminal = function( name , data ) {
	if ( name === 'SCREEN_RESIZE' && this.standAlone ) {
		this.resize( data.width , data.height ) ;
	}
} ;



TextEditor.prototype.runStateMachine = function() {
	if ( ! this.stateMachine ) { return ; }
	
	this.stateMachine.reset() ;

	this.textBuffer.iterate( { finalCall: true } , context => {
		context.textBuffer = this.textBuffer ;
		this.stateMachine.pushEvent( context.text , context ) ;
	} ) ;
} ;



TextEditor.prototype.draw = function( omitCursor ) {
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
TextEditor.prototype.drawCursor = function() {
	this.textBuffer.drawCursor() ;
	this.screenBuffer.drawCursor() ;
} ;



TextEditor.prototype.statusBar = function( str ) {
	if ( ! this.hasStatusBar ) { return ; }

	if ( typeof str !== 'string' ) { str = this.statusBarText ; }
	else { this.statusBarText = str ; }

	this.term.moveTo( this.x , this.statusBarY ).styleReset.bgWhite.blue.eraseLine( str ) ;

	this.drawCursor() ;
} ;



TextEditor.prototype.contextBar = function( str , options ) {
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
		this.contextBarTimer = setTimeout( contextBar.bind( this , '' ) , options.timeout ) ;
	}
} ;



TextEditor.prototype.fullRedraw = function() {
	this.fullRedrawNeeded = true ;
	this.draw() ;
	this.statusBar() ;
	this.contextBar() ;
} ;



TextEditor.prototype.resize = function( width , height ) {
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





TextEditor.prototype.followCursor = function() {
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

TextEditor.userAction = {} ;

TextEditor.userAction.up = function() {
	this.textBuffer.moveUp() ;
	this.cursorHint() ;
	if ( ! this.followCursor() ) { this.drawCursor() ; }
} ;



TextEditor.userAction.down = function() {
	this.textBuffer.moveDown() ;
	this.cursorHint() ;
	if ( ! this.followCursor() ) { this.drawCursor() ; }
} ;



TextEditor.userAction.backward = function() {
	this.textBuffer.moveBackward() ;
	this.cursorHint() ;
	if ( ! this.followCursor() ) { this.drawCursor() ; }
} ;



TextEditor.userAction.forward = function() {
	this.textBuffer.moveForward() ;
	this.cursorHint() ;
	if ( ! this.followCursor() ) { this.drawCursor() ; }
} ;



TextEditor.userAction.endOfLine = function() {
	this.textBuffer.moveToEndOfLine() ;
	this.cursorHint() ;
	if ( ! this.followCursor() ) { this.drawCursor() ; }
} ;



TextEditor.userAction.startOfLine = function() {
	this.textBuffer.moveToColumn( 0 ) ;
	this.cursorHint() ;
	if ( ! this.followCursor() ) { this.drawCursor() ; }
} ;



TextEditor.userAction.newLine = function() {
	this.textBuffer.newLine() ;
	this.runStateMachine() ;
	this.cursorHint() ;
	if ( ! this.followCursor() ) { this.draw() ; }
} ;



TextEditor.userAction.delete = function() {
	this.textBuffer.delete( 1 ) ;
	this.runStateMachine() ;
	this.cursorHint() ;
	this.draw() ;
} ;



TextEditor.userAction.backDelete = function() {
	this.textBuffer.backDelete( 1 ) ;
	this.runStateMachine() ;
	this.cursorHint() ;
	if ( ! this.followCursor() ) { this.draw() ; }
} ;



TextEditor.userAction.tab = function() {
	this.textBuffer.insert( '\t' ) ;
	this.runStateMachine() ;
	this.cursorHint() ;
	if ( ! this.followCursor() ) { this.draw() ; }
} ;



TextEditor.userAction.halfPageUp = function() {
	var delta = -Math.ceil( this.screenBuffer.height / 2 ) ;

	this.textBuffer.y = Math.min(
		0 ,
		this.textBuffer.y - delta
	) ;

	this.textBuffer.move( 0 , delta ) ;
	this.cursorHint() ;
	if ( ! this.followCursor() ) { this.draw() ; }
} ;



TextEditor.userAction.halfPageDown = function() {
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



TextEditor.userAction.save = function() {
	this.save() ;
} ;



TextEditor.userAction.open = function() {
	this.open() ;
} ;



TextEditor.userAction.terminate = function() {
	this.terminate() ;
} ;



TextEditor.userAction.redraw = function() {
	this.fullRedraw() ;
} ;

