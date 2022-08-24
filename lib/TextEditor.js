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

const string = require( 'string-kit' ) ;
const Promise = require( 'seventh' ) ;



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
	this.inlineFileInput = null ;

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
	
	CTRL_B: 'startOfSelection' ,
	CTRL_E: 'endOfSelection' ,
	CTRL_Y: 'copy' ,
	CTRL_P: 'paste' ,
	META_Y: 'copyClipboard' ,
	META_P: 'pasteClipboard' ,

	CTRL_S: 'save' ,
	CTRL_O: 'open' ,
	CTRL_C: 'terminate' ,
	CTRL_R: 'redraw' ,

	CTRL_K: 'meta' ,
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
		keyBindings: this.keyBindings ,
		stateMachine: this.stateMachine
	} ) ;

	this.statusBar = new Text( {
		internal: true ,
		parent: this ,
		contentHasMarkup: true ,
		attr: { color: 'black' , bgColor: 'white' } ,
		x: this.outputX ,
		y: this.outputY ,
		width: this.outputWidth ,
		height: 1
	} ) ;

	this.contextBar = new Text( {
		internal: true ,
		parent: this ,
		contentHasMarkup: true ,
		attr: { color: 'black' , bgColor: 'white' } ,
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

	// Here we have a special key

	switch( this.keyBindings[ key ] ) {
		case 'save' :
			this.save() ;
			//this.interactiveSave() ;
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


	return true ;		// Do not bubble up
} ;



TextEditor.prototype.setStatusBar = function( format , ... args ) {
	var str = args.length ? string.format( format , ... args ) : format ;
	this.statusBar.setContent( str , true ) ;
} ;



TextEditor.prototype.setContextBar = function( options , format , ... args ) {
	var str ;

	// Argument management
	if ( ! options || typeof options !== 'object' ) {
		str = arguments.length > 1 ? string.format( options , format , ... args ) : options ;
		options = null ;
	}
	else {
		str = args.length ? string.format( format , ... args ) : format ;
	}

	if ( this.contextBarTimer ) {
		clearTimeout( this.contextBarTimer ) ;
		this.contextBarTimer = null ;
	}

	// Useful?
	//if ( options.hint ) { this.contextBarIsHint = true ; }

	this.contextBar.setContent( str , true ) ;

	if ( options?.timeout ) {
		this.contextBarTimer = setTimeout( () => this.setContextBar( '' ) , options.timeout ) ;
	}
} ;



TextEditor.prototype.setFilePath = async function( filePath ) {
	if ( this.filePath === filePath ) { return ; }
	
	// Should advertise? With a .setContextBar()?
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
			this.editableTextBox.setContent( '' ) ;
			this.setContextBar( { timeout: 2000 } , 'New file' , filePath ) ;
		}
		else {
			throw error ;
		}
	}

	this.setFilePath( filePath ) ;

	textBuffer.runStateMachine() ;
	this.editableTextBox.draw() ;
} ;



TextEditor.prototype.interactiveOpen = async function() {
	try {
		var filePath = await this.askFileInline( {
			prompt: {
				textAttr: { bgColor: 'blue' } ,
				content: 'Open file: ' ,
				contentHasMarkup: true
			}
		} ) ;
		this.openFile( filePath , true ) ;
	}
	catch {}
} ;



TextEditor.prototype.save = async function() {
	if ( ! this.filePath ) { return ; }
	this.saveFile( this.filePath ) ;
} ;



TextEditor.prototype.saveFile = async function( filePath ) {
	var textBuffer = this.editableTextBox.textBuffer ;

	this.setContextBar( 'Saving %s ...' , filePath ) ;
	await textBuffer.save( filePath ) ;
	this.setContextBar( { timeout: 2000 } , '%s saved!' , filePath ) ;
	this.setFilePath( filePath ) ;
} ;



TextEditor.prototype.interactiveSave = async function() {
	try {
		var filePath = await this.askFileInline( {
			prompt: {
				textAttr: { bgColor: 'blue' } ,
				content: 'Save file: ' ,
				contentHasMarkup: true
			}
		} ) ;
		this.saveFile( filePath , true ) ;
	}
	catch {}
} ;



// Return a promise resolving to the file path, or reject if cancelled or various errors
TextEditor.prototype.askFileInline = function( options = null ) {
	// Already doing things with files?
	if ( this.inlineFileInput ) { return Promise.rejected ; }

	var promise = new Promise() ;

	var inlineFileInputOptions = {
		internal: true ,
		parent: this ,
		noEmpty: true ,
		accept: {
			unexistant: true ,
			file: true
		} ,
		cancelable: true ,
		baseDir: './' ,
		menu: { justify: false } ,
		//autoCompleteHint: false ,
		//textAttr: { bgColor: 'blue' } ,
		//voidAttr: { bgColor: 'blue' } ,
		x: this.outputX ,
		y: this.outputY + this.outputHeight - 2 ,
		z: 1 ,
		width: this.outputWidth ,

		//*
		prompt: {
			textAttr: { bgColor: 'blue' } ,
			content: 'Select a file' ,
			contentHasMarkup: true
		}
		//*/
	} ;

	if ( options ) { Object.assign( inlineFileInputOptions , options ) ; }

	this.inlineFileInput = new termkit.InlineFileInput( inlineFileInputOptions ) ;

	this.document.giveFocusTo( this.inlineFileInput ) ;

	this.inlineFileInput.once( 'cancel' , () => {
		//console.error( "Cancelling" ) ;
		this.inlineFileInput.destroy() ;
		this.inlineFileInput = null ;
		this.document.giveFocusTo( this.editableTextBox ) ;
		promise.reject() ;
	} ) ;

	this.inlineFileInput.once( 'submit' , filePath => {
		//console.error( "Submitting:" , filePath ) ;
		this.inlineFileInput.destroy() ;
		this.inlineFileInput = null ;
		this.document.giveFocusTo( this.editableTextBox ) ;
		promise.resolve( filePath ) ;
	} ) ;

	return promise ;
} ;



/*
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
*/

