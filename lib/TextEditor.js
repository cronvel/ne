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
const ToggleButton = termkit.ToggleButton ;
const DropDownMenu = termkit.DropDownMenu ;
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

	this.onFocus = this.onFocus.bind( this ) ;
	this.onChange = this.onChange.bind( this ) ;
	this.onCursorMove = this.onCursorMove.bind( this ) ;
	this.onToggleMenu = this.onToggleMenu.bind( this ) ;

	this.newLineAutoIndentHook = this.newLineAutoIndentHook.bind( this ) ;

	// Widget
	this.editableTextBox = null ;
	this.statusBar = null ;
	this.contextBar = null ;
	this.inlineInput = null ;
	this.showHideMenuButton = null ;
	this.dropDownMenu = null ;

	this.lockStatus = false ;
	this.updateStatusTimer = null ;
	this.updateStatusAgain = false ;

	this.contextBarTimer = null ;
	//this.contextBarIsHint = false ;

	this.stateMachine = null ;

	// Used for storing logs for undo/redo
	this.changelog = [] ;
	this.changelogIndex = 0 ;
	this.changelogSize = options.changelogSize ?? 20 ;
	this.logMergingTimeLimit = options.logMergingTimeLimit ?? 10000 ;

	this.terminate = typeof options.terminate === 'function' ? options.terminate : null ;
	this.filePath = null ;
	this.textMachinePath = null ;

	if ( options.keyBindings ) { this.keyBindings = options.keyBindings ; }

	// Options/modes configurable by the user on runtime
	this.autoIndentMode = options.autoIndentMode ?? true ;
	// TODO... It should be part of EditableTextBox
	this.scrollContextLines = options.scrollContextLines !== undefined ? options.scrollContextLines : 3 ;
	this.scrollContextColumns = options.scrollContextColumns !== undefined ? options.scrollContextColumns : 10 ;

	this.on( 'key' , this.onKey ) ;	// Don't remove: TextEditor does not inherit from EditableTextBox, it contains it
	this.on( 'focus' , this.onFocus ) ;

	this.initChildren() ;

	if ( this.setContent === TextEditor.prototype.setContent ) {
		this.setContent( options.content , true ) ;
	}

	// Only draw if we are not a superclass of the object
	if ( this.elementType === 'TextEditor' && ! options.noDraw ) { this.draw() ; }
}

module.exports = TextEditor ;
Element.inherit( TextEditor ) ;



TextEditor.prototype.needInput = true ;



// For instance, it's for both the EditableTextBox and the TextEditor (should probably be divided, like other widgets do)
TextEditor.prototype.keyBindings = {
	// EditableTextBox
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

	// TextEditor
	CTRL_S: 'save' ,
	CTRL_O: 'open' ,
	CTRL_C: 'terminate' ,
	CTRL_Z: 'undo' ,
	ALT_Z: 'redo' ,
	CTRL_R: 'redraw' ,
	META_L: 'goToLine' ,
	META_M: 'menu' ,

	// Both
	CTRL_K: 'meta'
} ;



TextEditor.prototype.initChildren = function() {
	this.stateMachine = new TextMachine( {
		program: require( 'text-machine/languages/javascript.js' ) ,
		api: termkit.TextBuffer.TextMachineApi
	} ) ;

	// The main widget, where the text is edited
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
		stateMachine: this.stateMachine ,
		newLineAutoIndentHook: this.newLineAutoIndentHook
	} ) ;
	this.editableTextBox.on( 'change' , this.onChange ) ;
	this.editableTextBox.on( 'cursorMove' , this.onCursorMove ) ;

	// A button used to show/hide the drop-down menu
	this.showHideMenuButton = new ToggleButton( {
		internal: true ,
		parent: this ,
		content: ' » ' ,
		turnedOnContent: ' « ' ,
		turnedOffContent: ' » ' ,
		value: false ,
		x: this.outputX ,
		y: this.outputY ,
		width: 3
	} ) ;
	this.showHideMenuButton.on( 'toggle' , this.onToggleMenu ) ;

	// Top
	this.statusBar = new Text( {
		internal: true ,
		parent: this ,
		contentHasMarkup: true ,
		attr: { color: 'black' , bgColor: 'white' } ,
		x: this.outputX + 3 ,
		y: this.outputY ,
		width: this.outputWidth - 3 ,
		height: 1
	} ) ;

	// Bottom
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



TextEditor.prototype.onChange = function( data ) {
	if ( data ) { this.addChangeLog( data ) ; }
	this.updateStatusDebounced() ;
} ;



TextEditor.prototype.onCursorMove = function() {
	this.updateStatusDebounced() ;
} ;



TextEditor.prototype.onToggleMenu = function( value ) {
	if ( value === !! this.dropDownMenu ) { return ; }
	
	if ( this.dropDownMenu ) {
		this.dropDownMenu.destroy() ;
		this.dropDownMenu = null ;
		return ;
	}
	
	this.dropDownMenu = new DropDownMenu( {
		parent: this ,
		x: 3 ,
		y: 0 ,
		clearColumnMenuOnSubmit: true ,
		items: [
			{
				content: 'File' ,
				value: 'file' ,
				items: [
					{ content: 'Load' , value: 'load' } ,
					{ content: 'Save' , value: 'save' } ,
					{ content: 'Save as' , value: 'saveAs' }
				]
			} ,
			{
				content: 'Edit' ,
				value: 'edit' ,
				items: [
					{ content: 'Copy' , value: 'copy' } ,
					{ content: 'Paste' , value: 'paste' } ,
					{ content: 'Undo' , value: 'undo' } ,
					{ content: 'Redo' , value: 'redo' } ,
					{ content: 'Autoindent' , value: 'toggleAutoIndent' } ,
				]
			} ,
		]
	} ) ;
} ;



TextEditor.prototype.addChangeLog = function( data ) {
	data.time = Date.now() ;

	var lastData = this.changelogIndex > 0 ? this.changelog[ this.changelogIndex - 1 ] : null ;

	if ( this.changelogIndex < this.changelog.length ) {
		// Most probably we have undone something, and now we start modifying from that point
		this.changelog.length = this.changelogIndex ;
	}

	if (
		lastData
		&& data.type === lastData.type
		&& data.startPosition.x === lastData.endPosition.x
		&& data.startPosition.y === lastData.endPosition.y
		&& data.time < lastData.time + this.logMergingTimeLimit
	) {
		// Merge
		//console.error( "merging: " , lastData , data ) ;
		lastData.endPosition = data.endPosition ;

		if ( data.type === 'delete' ) {
			lastData.deletedString += data.deletedString ;
			lastData.count += data.count ;
		}
		else if ( data.type === 'backDelete' ) {
			lastData.deletedString = data.deletedString + lastData.deletedString ;
			lastData.count += data.count ;
		}
		else if ( data.type === 'insert' ) {
			lastData.insertedString += data.insertedString ;
			lastData.count += data.count ;
		}
	}
	else {
		this.changelog.push( data ) ;
		if ( this.changelog.length > this.changelogSize ) {
			this.changelog.splice( 0 , this.changelog.length - this.changelogSize ) ;
		}

		this.changelogIndex = this.changelog.length ;
	}

	//console.error( "changelog:" , this.changelog ) ;

	this.updateStatusDebounced() ;
} ;



// To be called immediately after a new line
TextEditor.prototype.autoIndent = function( internal = false ) {
	var indentStr = null ,
		textBuffer = this.editableTextBox.textBuffer ,
		y = textBuffer.cy ;

	while ( -- y >= 0 && indentStr === null ) {
		indentStr = textBuffer.getLineIndent( y ) ;
	}

	if ( indentStr ) {
		textBuffer.insert( indentStr ) ;
		
		if ( ! internal ) {
			textBuffer.runStateMachine() ;
			this.editableTextBox.autoScrollAndDraw() ;
		}
	}

	return indentStr ;
} ;



TextEditor.prototype.interactiveGoToLine = async function() {
	try {
		var line = await this.askInline( {
			prompt: {
				textAttr: { bgColor: 'blue' } ,
				content: 'Go to line: ' ,
				contentHasMarkup: true
			}
		} ) ;
		line = parseInt( line , 10 ) ;
		if ( line ) {
			this.goToLine( line ) ;
		}
	}
	catch {}
} ;



TextEditor.prototype.goToLine = function( line ) {
	if ( line <= 0 ) { return ; }

	var textBuffer = this.editableTextBox.textBuffer ;
	textBuffer.cy = line - 1 ;
	this.editableTextBox.autoScrollAndDraw() ;
	this.onCursorMove() ;
} ;



TextEditor.prototype.undo = function() {
	if ( this.changelogIndex <= 0 ) {
		this.setContextBar( { timeout: 2000 } , "Nothing to undo..." ) ;
		return ;
	}

	this.revertLog( this.changelog[ -- this.changelogIndex ] ) ;
	this.editableTextBox.textBuffer.runStateMachine() ;
	this.editableTextBox.autoScrollAndDraw() ;
} ;



TextEditor.prototype.redo = function() {
	if ( this.changelogIndex >= this.changelog.length ) {
		this.setContextBar( { timeout: 2000 } , "Nothing to redo..." ) ;
		return ;
	}

	this.playLog( this.changelog[ this.changelogIndex ++ ] ) ;
	this.editableTextBox.textBuffer.runStateMachine() ;
	this.editableTextBox.autoScrollAndDraw() ;
} ;



// Play a changelog's entry
TextEditor.prototype.playLog = function( entry ) {
	var textBuffer = this.editableTextBox.textBuffer ;
	textBuffer.cx = entry.startPosition.x ;
	textBuffer.cy = entry.startPosition.y ;

	switch ( entry.type ) {
		case 'insert' :
			textBuffer.insert( entry.insertedString ) ;
			break ;
		case 'delete' :
			textBuffer.delete( entry.count ) ;
			break ;
		case 'backDelete' :
			textBuffer.backDelete( entry.count ) ;
			break ;
	}

	// Should not be necessary
	textBuffer.cx = entry.endPosition.x ;
	textBuffer.cy = entry.endPosition.y ;
} ;



// Revert a changelog's entry
TextEditor.prototype.revertLog = function( entry ) {
	var textBuffer = this.editableTextBox.textBuffer ;
	textBuffer.cx = entry.endPosition.x ;
	textBuffer.cy = entry.endPosition.y ;

	switch ( entry.type ) {
		case 'insert' :
			textBuffer.backDelete( entry.count ) ;
			break ;
		case 'delete' :
			textBuffer.insert( entry.deletedString ) ;
			break ;
		case 'backDelete' :
			textBuffer.insert( entry.deletedString ) ;
			break ;
	}

	// Should not be necessary
	textBuffer.cx = entry.startPosition.x ;
	textBuffer.cy = entry.startPosition.y ;
} ;



const DEBOUNCE_DELAY = 500 ;

TextEditor.prototype.updateStatusDebounced = function() {
	if ( this.lockStatus ) { return ; }

	if ( this.updateStatusTimer ) {
		this.updateStatusAgain = true ;
	}
	else {
		this.updateStatus() ;
		this.updateStatusTimer = setTimeout( () => {
			this.updateStatusTimer = null ;
			if ( this.updateStatusAgain ) {
				this.updateStatusAgain = false ;
				this.updateStatusDebounced() ;
			}
		} , DEBOUNCE_DELAY ) ;
	}
} ;



TextEditor.prototype.updateStatus = function() {
	if ( this.lockStatus ) { return ; }
	var textBuffer = this.editableTextBox.textBuffer ;
	this.setStatusBar( "Line %i  Col %i" , textBuffer.cy + 1 , textBuffer.cx + 1 ) ;
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



// Return a promise resolving to the input string, or reject if cancelled or various errors
TextEditor.prototype.askInline = function( options = null ) {
	// Already doing things with files?
	if ( this.inlineInput ) { return Promise.rejected ; }

	var promise = new Promise() ;

	var inlineInputOptions = {
		internal: true ,
		parent: this ,
		noEmpty: true ,
		cancelable: true ,
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
			content: '> ' ,
			contentHasMarkup: true
		}
		//*/
	} ;

	if ( options ) { Object.assign( inlineInputOptions , options ) ; }

	this.inlineInput = new termkit.InlineInput( inlineInputOptions ) ;

	this.document.giveFocusTo( this.inlineInput ) ;

	this.inlineInput.once( 'cancel' , () => {
		//console.error( "Cancelling" ) ;
		this.inlineInput.destroy() ;
		this.inlineInput = null ;
		this.document.giveFocusTo( this.editableTextBox ) ;
		promise.reject() ;
	} ) ;

	this.inlineInput.once( 'submit' , inputStr => {
		//console.error( "Submitting:" , filePath ) ;
		this.inlineInput.destroy() ;
		this.inlineInput = null ;
		this.document.giveFocusTo( this.editableTextBox ) ;
		promise.resolve( inputStr ) ;
	} ) ;

	return promise ;
} ;



// Return a promise resolving to the file path, or reject if cancelled or various errors
TextEditor.prototype.askFileInline = function( options = null ) {
	// Already doing things with files?
	if ( this.inlineInput ) { return Promise.rejected ; }

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

	this.inlineInput = new termkit.InlineFileInput( inlineFileInputOptions ) ;

	this.document.giveFocusTo( this.inlineInput ) ;

	this.inlineInput.once( 'cancel' , () => {
		//console.error( "Cancelling" ) ;
		this.inlineInput.destroy() ;
		this.inlineInput = null ;
		this.document.giveFocusTo( this.editableTextBox ) ;
		promise.reject() ;
	} ) ;

	this.inlineInput.once( 'submit' , filePath => {
		//console.error( "Submitting:" , filePath ) ;
		this.inlineInput.destroy() ;
		this.inlineInput = null ;
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



// HOOKS

TextEditor.prototype.newLineAutoIndentHook = function() {
	this.autoIndent( true ) ;
} ;



// User Actions

const userActions = TextEditor.prototype.userActions ;

userActions.goToLine = function() {
	this.interactiveGoToLine() ;
} ;

userActions.undo = function() {
	this.undo() ;
} ;

userActions.redo = function() {
	this.redo() ;
} ;

userActions.redraw = function() {
	this.redraw() ;
} ;

userActions.save = function() {
	this.save() ;
	//this.interactiveSave() ;
} ;

userActions.open = function() {
	this.interactiveOpen() ;
} ;

userActions.terminate = function() {
	if ( this.terminate ) { this.terminate() ; }
} ;

