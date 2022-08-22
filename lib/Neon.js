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
//const term = termkit.terminal ;
const TextEditor = require( './TextEditor.js' ) ;



function Neon( options = {} ) {
	this.term = options.term || termkit.terminal ;

	this.document = null ;
	this.textEditor = null ;
}

module.exports = Neon ;



Neon.prototype.terminate = function() {
	this.term.fullscreen( false ) ;
	this.term.applicationKeypad( false ) ;
	this.term.beep() ;
	this.term.processExit() ;
} ;



Neon.prototype.run = function() {
	this.term.fullscreen() ;

	this.document = this.term.createDocument( {
		//  backgroundAttr: { bgColor: 'magenta' , dim: true } ,
	} ) ;

	this.textEditor = new TextEditor( {
		parent: this.document ,
		x: 0 ,
		y: 0 ,
		width: this.term.width ,
		height: this.term.height ,
		terminate: () => this.terminate()
	} ) ;

	this.document.giveFocusTo( this.textEditor ) ;

	//this.statusBar( 'Welcome to Neon!' ) ;
	//this.contextBar( 'Ctrl-C to quit' ) ;

	// Bind the 'key' event to the key handler
	//this.term.on( 'key' , Neon.prototype.onKey.bind( this ) ) ;

	// Bind the 'terminal' event to the terminal event handler
	//this.term.on( 'terminal' , Neon.prototype.onTerminal.bind( this ) ) ;
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



Neon.prototype.onTerminal = function( name , data ) {
	if ( name === 'SCREEN_RESIZE' && this.standAlone ) {
		this.resize( data.width , data.height ) ;
	}
} ;








Neon.userAction = {} ;

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

