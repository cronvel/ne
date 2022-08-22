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
const Text = termkit.Text ;
const TextBox = termkit.TextBox ;
const EditableTextBox = termkit.EditableTextBox ;

const TextMachine = require( 'text-machine' ) ;



function TextEditor( options = {} ) {
	// Clone options if necessary
	options = ! options ? {} : options.internal ? options : Object.create( options ) ;
	options.internal = true ;

	Element.call( this , options ) ;
	
	this.onKey = this.onKey.bind( this ) ;
	this.onFocus = this.onFocus.bind( this ) ;

	this.editableTextBox = null ;
	this.statusBar = null ;

	this.contextBar = null ;
	this.contextBarTimer = null ;
	//this.contextBarIsHint = false ;

	this.stateMachine = null ;

	this.terminate = typeof options.terminate === 'function' ? options.terminate : null ;
	this.filePath = null ;
	this.textMachinePath = null ;

	if ( options.keyBindings ) { this.keyBindings = options.keyBindings ; }

	// TODO... It should be part of EditableTextBox
	this.scrollContextLines = options.scrollContextLines !== undefined ? options.scrollContextLines : 3 ;
	this.scrollContextColumns = options.scrollContextColumns !== undefined ? options.scrollContextColumns : 10 ;

	this.on( 'key' , this.onKey ) ;
	this.on( 'focus' , this.onFocus ) ;

	this.initChildren() ;

	if ( this.setContent === TextEditor.prototype.setContent ) {
		this.setContent( options.content , true ) ;
	}

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

	this.off( 'key' , this.onKey ) ;
	this.off( 'focus' , this.onFocus ) ;

	Element.prototype.destroy.call( this , isSubDestroy , noDraw ) ;
} ;



TextEditor.prototype.keyBindings = {
	ENTER: 'newLine' ,
	KP_ENTER: 'newLine' ,
	BACKSPACE: 'backDelete' ,
	DELETE: 'delete' ,
	TAB: 'tab' ,

	CTRL_C: 'copyClipboard' ,
	CTRL_V: 'pasteClipboard' ,

	LEFT: 'backward' ,
	RIGHT: 'forward' ,
	CTRL_LEFT: 'startOfWord' ,
	CTRL_RIGHT: 'endOfWord' ,
	UP: 'up' ,
	DOWN: 'down' ,
	HOME: 'startOfLine' ,
	END: 'endOfLine' ,
	PAGE_UP: 'scrollUp' ,
	PAGE_DOWN: 'scrollDown' ,

	CTRL_S: 'save' ,
	CTRL_O: 'open' ,
	CTRL_Q: 'terminate' ,
	CTRL_R: 'redraw'
} ;



TextEditor.prototype.initChildren = function() {
	this.stateMachine = new TextMachine( {
		program: require( 'text-machine/languages/javascript.js' ) ,
		api: termkit.TextBuffer.TextMachineApi
	} ) ;

	this.editableTextBox = new EditableTextBox( {
		internal: true ,
		parent: this ,
		x: this.outputX ,
		y: this.outputY + 1 ,
		width: this.outputWidth ,
		height: this.outputHeight - 2 ,
		scrollable: true ,
		vScrollBar: true ,
		stateMachine: this.stateMachine
	} ) ;

	this.statusBar = new Text( {
		parent: this ,
		contentHasMarkup: true ,
		x: this.outputX ,
		y: this.outputY ,
		width: this.outputWidth ,
		height: 1
	} ) ;

	this.contextBar = new Text( {
		parent: this ,
		contentHasMarkup: true ,
		x: this.outputX ,
		y: this.outputY + this.outputHeight - 1 ,
		width: this.outputWidth ,
		height: 1
	} ) ;
} ;



//TextEditor.prototype.drawSelfCursor = function() { this.textBuffer.drawCursor() ; } ;

TextEditor.prototype.getValue = TextBox.prototype.getContent = function() {
	return this.editableTextBox.getContent() ;
} ;

TextEditor.prototype.setValue = function( value , dontDraw ) {
	return this.editableTextBox.setValue( value , dontDraw ) ;
} ;

TextEditor.prototype.setContent = function( value , dontDraw ) {
	return this.editableTextBox.setContent( value , dontDraw ) ;
} ;



TextEditor.prototype.onFocus = function( focus , type ) {
	if ( focus ) {
		this.document.giveFocusTo( this.editableTextBox ) ;
	}
} ;



TextEditor.prototype.onKey = function( key , trash , data ) {
	if ( data && data.isCharacter ) {
		// Bubble up
		return ;
	}
	else {
		// Here we have a special key

		switch( this.keyBindings[ key ] ) {
			case 'save' :
				this.save() ;
				break ;
			case 'open' :
				this.interactiveOpen() ;
				break ;
			case 'terminate' :
				if ( this.terminate ) { this.terminate() ; }
				break ;
			case 'redraw' :
				this.redraw() ;
				break ;
			default :
				return ;    // Bubble up
		}
	}
} ;



TextEditor.prototype.setFilePath = async function( filePath ) {
	this.filePath = filePath ;
} ;



TextEditor.prototype.openFile = async function( filePath , createIfNotExist = false ) {
	var textBuffer = this.editableTextBox.textBuffer ;
	
	try {
		await textBuffer.load( filePath ) ;
	}
	catch ( error ) {
		if ( error.code === 'ENOENT' && createIfNotExist ) {
			this.setFilePath( filePath ) ;
		}
		else {
			throw error ;
		}
	}

	this.filePath = filePath ;

	textBuffer.runStateMachine() ;
	this.editableTextBox.draw() ;
} ;



TextEditor.prototype.saveFile = async function( filePath ) {
	var textBuffer = this.editableTextBox.textBuffer ;
	
	await textBuffer.save( filePath ) ;
	this.filePath = filePath ;
} ;



TextEditor.prototype.save = async function() {
	if ( ! this.filePath ) { return ; }
	this.saveFile( this.filePath ) ;
} ;















// TODO:


TextEditor.prototype.interactiveOpen = async function() {
	var filePath , options ;

	// Leave room for the singleLineMenu
	//this.term.moveTo( this.x , this.y + this.height - 2 ).bgWhite.blue.eraseLine( 'Save to: ' ) ;
	this.setContextBar( 'Open: ' , { cursor: false } ) ;

	options = {
		cancelable: true ,
		style: this.term.bgWhite.blue
	} ;

	try {
		filePath = await this.term.fileInput( options ) ;
	}
	finally {
		this.draw() ;
	}

	if ( ! filePath ) {
		// Aborted by user
		this.setContextBar( 'Ok then...' , { timeout: 2000 } ) ;
		return ;
	}

	try {
		await this.openFile( filePath ) ;
	}
	catch ( error ) {
		this.setContextBar( 'Failed to load: ' + error.toString() ) ;
		throw error ;
	}

	this.setContextBar( 'Loaded!' , { timeout: 2000 } ) ;
	this.draw() ;
} ;



TextEditor.prototype.interactiveSave = async function() {
	var filePath , options ;

	this.pauseMainUserEvent = true ;

	// Leave room for the singleLineMenu
	//this.term.moveTo( this.x , this.y + this.height - 2 ).bgWhite.blue.eraseLine( 'Save to: ' ) ;
	this.setContextBar( 'Save to: ' , { cursor: false } ) ;

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
		this.setContextBar( 'Ok then...' , { timeout: 2000 } ) ;
		return ;
	}

	try {
		await this.saveFile( filePath ) ;
	}
	catch ( error ) {
		this.setContextBar( 'Failed to save: ' + error.toString() ) ;
		throw error ;
	}

	this.setContextBar( 'Saved!' , { timeout: 2000 } ) ;
} ;



TextEditor.prototype.cursorHint = function() {
	var misc ;

	if ( this.textBuffer.cx ) {
		misc = this.textBuffer.getMiscAt( this.textBuffer.cx - 1 , this.textBuffer.cy ) ;
	}

	this.setContextBar( misc && misc.hint , { hint: true } ) ;
} ;



TextEditor.prototype.onTerminal = function( name , data ) {
	if ( name === 'SCREEN_RESIZE' && this.standAlone ) {
		this.resize( data.width , data.height ) ;
	}
} ;



/*
// Draw the cursor, i.e. move it on screen where the textBuffer cursor is
TextEditor.prototype.drawCursor = function() {
	this.textBuffer.drawCursor() ;
	this.screenBuffer.drawCursor() ;
} ;
//*/



TextEditor.prototype.setStatusBar = function( str ) {
	this.statusBar.setContent( str ) ;
} ;



TextEditor.prototype.setContextBar = function( str , options = {} ) {
	if ( this.contextBarTimer ) {
		clearTimeout( this.contextBarTimer ) ;
		this.contextBarTimer = null ;
	}

	// Useful?
	//if ( options.hint ) { this.contextBarIsHint = true ; }

	this.contextBar.setContent( str ) ;
	//this.term.moveTo( this.x , this.contextBarY ).styleReset.bgWhite.blue.eraseLine( str ) ;

	if ( options.timeout ) {
		this.contextBarTimer = setTimeout( () => this.setContextBar( '' ) , options.timeout ) ;
	}
} ;

