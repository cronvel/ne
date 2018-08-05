/*
	The Cedric's Swiss Knife (CSK) - Neon

	Copyright (c) 2015 Cédric Ronvel 
	
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



// Load modules
var ne = require( './ne.js' ) ;

var termKit = require( 'terminal-kit' ) ;
//var tree = require( 'tree-kit' ) ;



function Neon() { throw new Error( "Use Neon.create() instead." ) ; }
module.exports = Neon ;



Neon.create = function create( options )
{
	if ( ! options || typeof options !== 'object' ) { options = {} ; }
	
	var neon = Object.create( Neon.prototype , {
		term: { value: options.term || termKit.terminal , enumerable: true , writable: true } ,
		standAlone: { value: !! options.standAlone , enumerable: true , writable: true } ,
		emptyCellAttr: { value: options.emptyCellAttr || termKit.ScreenBuffer.DEFAULT_ATTR , enumerable: true , writable: true } ,
		attr: { value: options.attr || termKit.ScreenBuffer.DEFAULT_ATTR , enumerable: true , writable: true } ,
		pauseMainUserEvent: { value: false , enumerable: true , writable: true } ,
		fullRedrawNeeded: { value: false , enumerable: true , writable: true } ,
		
		hasStatusBar: { value: options.statusBar === undefined ? true : !! options.statusBar , enumerable: true , writable: true } ,
		statusBarText: { value: '' , enumerable: true , writable: true } ,
		
		hasContextBar: { value: options.contextBar === undefined ? true : !! options.contextBar , enumerable: true , writable: true } ,
		contextBarText: { value: '' , enumerable: true , writable: true } ,
		
		filePath: { value: '' , enumerable: true , writable: true } ,
		
		keyBindings: { value: defaultKeyBindings , enumerable: true , writable: true } ,
		
		scrollContextLines: { value: options.scrollContextLines !== undefined ? options.scrollContextLines : 3 , enumerable: true , writable: true } ,
		scrollContextColumns: { value: options.scrollContextColumns !== undefined ? options.scrollContextColumns : 10 , enumerable: true , writable: true } ,
	} ) ;
	
	Object.defineProperties( neon , {
		x: { value: options.x || 1 , enumerable: true , writable: true } ,
		y: { value: options.y || 1 , enumerable: true , writable: true } ,
		width: { value: options.width || neon.term.width , enumerable: true , writable: true } ,
		height: { value: options.height || neon.term.height , enumerable: true , writable: true }
	} ) ;
	
	Object.defineProperties( neon , {
		statusBarY: { value: neon.y , enumerable: true , writable: true } ,
		contextBarY: { value: neon.y + neon.height - 1 , enumerable: true , writable: true }
	} ) ;
	
	var screenBuffer = termKit.ScreenBuffer.create( {
		dst: neon.term ,
		x: neon.x ,
		y: neon.y + ( neon.standAlone ? 1 : 0 ) ,
		width: neon.width ,
		height: neon.height + ( neon.standAlone ? -2 : 0 )
	} ) ;
	
	var textBuffer = termKit.TextBuffer.create( {
		forceInBound: options.forceInBound === undefined ? true : options.forceInBound ,
		dst: screenBuffer
	} ) ;
	
	var stateMachine = ne.StateMachine.create( {
		hostMethods: ne.stateMachineApi
	} ) ;
	
	
	Object.defineProperties( neon , {
		screenBuffer: { value: screenBuffer , enumerable: true , writable: true } ,
		textBuffer: { value: textBuffer , enumerable: true , writable: true } ,
		stateMachine: { value: stateMachine , enumerable: true , writable: true }
	} ) ;
	
	return neon ;
} ;



function noop() {}



Neon.prototype.terminate = function terminate()
{
	var self = this ;
	
	if ( ! this.standAlone ) { return ; }
	
	setTimeout( function() {
		//self.term.brightBlack( 'About to exit...\n' ) ;
		self.term.grabInput( false ) ;
		self.term.fullscreen( false ) ;
		self.term.applicationKeypad( false ) ;
		self.term.beep() ;
		
		// Add a 100ms delay, so the terminal will be ready when the process effectively exit, preventing bad escape sequences drop
		setTimeout( function() { process.exit() ; } , 100 ) ;
	} , 100 ) ;
} ;



Neon.prototype.standAloneInit = function standAloneInit()
{
	this.term.fullscreen() ;
} ;



Neon.prototype.run = function run()
{
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



Neon.prototype.openFile = function openFile( path , callback )
{
	var self = this ;
	
	if ( typeof callback !== 'function' ) { callback = noop ; }
	this.pauseMainUserEvent = true ;
	
	this.textBuffer.load( path , function( error ) {
		
		self.pauseMainUserEvent = false ;
		
		if ( error ) { callback( error ) ; return ; }
		
		self.filePath = path ;
		
		self.runStateMachine() ;
		self.draw() ;
		
		callback() ;
	} ) ;
} ;



Neon.prototype.saveFile = function saveFile( path , callback )
{
	var self = this ;
	
	if ( typeof callback !== 'function' ) { callback = noop ; }
	this.pauseMainUserEvent = true ;
	
	this.textBuffer.save( path , function( error ) {
		
		self.pauseMainUserEvent = false ;
		
		if ( error ) { callback( error ) ; return ; }
		
		self.filePath = path ;
		callback() ;
	} ) ;
} ;



Neon.prototype.open = function open( callback )
{
	var self = this ;
	
	if ( typeof callback !== 'function' ) { callback = noop ; }
	this.pauseMainUserEvent = true ;
	
	// Leave room for the singleLineMenu
	//this.term.moveTo( this.x , this.y + this.height - 2 ).bgWhite.blue.eraseLine( 'Save to: ' ) ;
	this.contextBar( 'Open: ' , { cursor: false } ) ;
	
	var options = {
		cancelable: true ,
		style: this.term.bgWhite.blue
	} ;
	
	this.term.fileInput( options , function( error , path ) {
		
		self.pauseMainUserEvent = false ;
		self.fullRedrawNeeded = true ;	// Because of eventual singleLineMenu() scrolling
		self.draw() ;
		
		if ( error )
		{
			callback( error ) ;
			return ;
		}
		else if ( ! path )
		{
			// Aborted by user
			self.contextBar( 'Ok then...' , { timeout: 2000 } ) ;
			callback() ;
			return ;
		}
		
		self.openFile( path , function( error ) {
			
			if ( error )
			{
				self.contextBar( 'Failed to load: ' + error.toString() ) ;
				callback( error ) ;
				return ;
			}
			
			self.contextBar( 'Loaded!' , { timeout: 2000 } ) ;
			self.draw() ;
			callback() ;
		} ) ;
	} ) ;
} ;



Neon.prototype.save = function save( callback )
{
	var self = this ;
	
	if ( typeof callback !== 'function' ) { callback = noop ; }
	this.pauseMainUserEvent = true ;
	
	// Leave room for the singleLineMenu
	//this.term.moveTo( this.x , this.y + this.height - 2 ).bgWhite.blue.eraseLine( 'Save to: ' ) ;
	this.contextBar( 'Save to: ' , { cursor: false } ) ;
	
	var options = {
		cancelable: true ,
		default: self.filePath ,
		style: this.term.bgWhite.blue
	} ;
	
	this.term.fileInput( options , function( error , path ) {
		
		self.pauseMainUserEvent = false ;
		self.fullRedrawNeeded = true ;	// Because of eventual singleLineMenu() scrolling
		self.draw() ;
		
		if ( error )
		{
			callback( error ) ;
			return ;
		}
		else if ( ! path )
		{
			// Aborted by user
			self.contextBar( 'Ok then...' , { timeout: 2000 } ) ;
			callback() ;
			return ;
		}
		
		self.saveFile( path , function( error ) {
			
			if ( error )
			{
				self.contextBar( 'Failed to save: ' + error.toString() ) ;
				callback( error ) ;
				return ;
			}
			
			self.contextBar( 'Saved!' , { timeout: 2000 } ) ;
			callback() ;
		} ) ;
	} ) ;
} ;



Neon.prototype.onKey = function onKey( key , matches , data )
{
	if ( data.isCharacter )
	{
		// User interactions are disabled (file loading, etc), so return now!
		if ( this.pauseMainUserEvent ) { return ; }
		
		this.textBuffer.insert( key , this.attr ) ;
		this.runStateMachine() ;
		this.cursorHint() ;
		if ( ! this.followCursor() ) { this.draw() ; }
	}
	else if ( this.keyBindings[ key ] )
	{
		// User interactions are disabled (file loading, etc), except the 'terminate' action
		if ( this.pauseMainUserEvent && this.keyBindings[ key ] !== 'terminate' ) { return ; }
		
		Neon.userAction[ this.keyBindings[ key ] ].call( this ) ;
	}
} ;



Neon.prototype.cursorHint = function cursorHint()
{
	var misc ;
	
	if ( this.textBuffer.cx ) {
		misc = this.textBuffer.getMiscAt( this.textBuffer.cx - 1 , this.textBuffer.cy ) ;
	}
	
	this.contextBar( misc && misc.hint , { hint: true } ) ;
} ;



Neon.prototype.onTerminal = function onTerminal( name , data )
{
	if ( name === 'SCREEN_RESIZE' && this.standAlone )
	{
		this.resize( data.width , data.height ) ;
	}
} ;



Neon.prototype.runStateMachine = function runStateMachine()
{
	var self = this ;
	this.stateMachine.reset() ;
	
	this.textBuffer.iterate( { finalCall: true } , function( data ) {
		
		data.neon = self ;
		self.stateMachine.pushEvent( data.text , data ) ;
	} ) ;
} ;



Neon.prototype.draw = function draw( omitCursor )
{
	this.textBuffer.draw() ;
	this.screenBuffer.draw( { delta: ! this.fullRedrawNeeded } ) ;

	// Draw the cursor, i.e. move it on screen where the textBuffer cursor is
	if ( ! omitCursor )
	{
		this.textBuffer.drawCursor() ;
		this.screenBuffer.drawCursor() ;
	}
	
	if ( this.fullRedrawNeeded )
	{
		this.statusBar() ;
		this.contextBar() ;
	}
	
	this.fullRedrawNeeded = false ;
} ;



// Draw the cursor, i.e. move it on screen where the textBuffer cursor is
Neon.prototype.drawCursor = function drawCursor()
{
	this.textBuffer.drawCursor() ;
	this.screenBuffer.drawCursor() ;
} ;



Neon.prototype.statusBar = function statusBar( str )
{
	if ( ! this.hasStatusBar ) { return ; }
	
	if ( typeof str !== 'string' ) { str = this.statusBarText ; }
	else { this.statusBarText = str ; }
	
	this.term.moveTo( this.x , this.statusBarY ).styleReset.bgWhite.blue.eraseLine( str ) ;
	
	this.drawCursor() ;
} ;



Neon.prototype.contextBar = function contextBar( str , options )
{
	if ( ! this.hasContextBar ) { return ; }
	
	options = options || {} ;
	
	if ( this.contextBarTimer )
	{
		clearTimeout( this.contextBarTimer ) ;
		this.contextBarTimer = null ;
	}
	
	if ( options.hint ) { this.contextBarIsHint = true ; }
	
	if ( typeof str !== 'string' )
	{
		if ( options.hint && this.contextBarIsHint ) { str = '' ; }
		else { str = this.contextBarText ; }
		
		this.contextBarIsHint = false ;
	}
	else
	{
		this.contextBarText = str ;
		
		if ( options.hint ) { this.contextBarIsHint = true ; }
		else { this.contextBarIsHint = false ; }
	}
	
	this.term.moveTo( this.x , this.contextBarY ).styleReset.bgWhite.blue.eraseLine( str ) ;
	
	if ( ! ( 'cursor' in options ) || options.cursor ) { this.drawCursor() ; }
	
	if ( options.timeout )
	{
		this.contextBarTimer = setTimeout( contextBar.bind( this , '' ) , options.timeout ) ;
	}
} ;



Neon.prototype.fullRedraw = function fullRedraw()
{
	this.fullRedrawNeeded = true ;
	this.draw() ;
	this.statusBar() ;
	this.contextBar() ;
} ;



Neon.prototype.resize = function resize( width , height )
{
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





Neon.prototype.followCursor = function followCursor()
{
	var oldX = this.textBuffer.x ,
		oldY = this.textBuffer.y ,
		scrollContextLines = Math.min( this.scrollContextLines , Math.floor( ( this.screenBuffer.height - 1 ) / 2 ) ) ,
		scrollContextColumns = Math.min( this.scrollContextColumns , Math.floor( ( this.screenBuffer.width - 1 ) / 2 ) ) ;
	
	if ( this.textBuffer.x < - this.textBuffer.cx + scrollContextColumns )
	{
		this.textBuffer.x = Math.min( 0 , - this.textBuffer.cx + scrollContextColumns ) ;
	}
	else if ( this.textBuffer.x > - this.textBuffer.cx + this.screenBuffer.width - scrollContextColumns - 1 )
	{
		this.textBuffer.x = - this.textBuffer.cx + this.screenBuffer.width - scrollContextColumns - 1 ;
	}
	
	if ( this.textBuffer.y < - this.textBuffer.cy + scrollContextLines )
	{
		this.textBuffer.y = Math.min( 0 , - this.textBuffer.cy + scrollContextLines ) ;
	}
	else if ( this.textBuffer.y > - this.textBuffer.cy + this.screenBuffer.height - scrollContextLines - 1 )
	{
		this.textBuffer.y = - this.textBuffer.cy + this.screenBuffer.height - scrollContextLines - 1 ;
	}
	
	if ( this.textBuffer.x !== oldX || this.textBuffer.y !== oldY )
	{
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
	CTRL_R: 'redraw' ,
} ;

Neon.userAction = {} ;

Neon.userAction.up = function up()
{
	this.textBuffer.moveUp() ;
	this.cursorHint() ;
	if ( ! this.followCursor() ) { this.drawCursor() ; }
} ;



Neon.userAction.down = function down()
{
	this.textBuffer.moveDown() ;
	this.cursorHint() ;
	if ( ! this.followCursor() ) { this.drawCursor() ; }
} ;



Neon.userAction.backward = function backward()
{
	this.textBuffer.moveBackward() ;
	this.cursorHint() ;
	if ( ! this.followCursor() ) { this.drawCursor() ; }
} ;



Neon.userAction.forward = function forward()
{
	this.textBuffer.moveForward() ;
	this.cursorHint() ;
	if ( ! this.followCursor() ) { this.drawCursor() ; }
} ;



Neon.userAction.endOfLine = function endOfLine()
{
	this.textBuffer.moveToEndOfLine() ;
	this.cursorHint() ;
	if ( ! this.followCursor() ) { this.drawCursor() ; }
} ;



Neon.userAction.startOfLine = function startOfLine()
{
	this.textBuffer.moveToColumn( 0 ) ;
	this.cursorHint() ;
	if ( ! this.followCursor() ) { this.drawCursor() ; }
} ;



Neon.userAction.newLine = function newLine()
{
	this.textBuffer.newLine() ;
	this.runStateMachine() ;
	this.cursorHint() ;
	if ( ! this.followCursor() ) { this.draw() ; }
} ;



Neon.userAction.delete = function delete_()
{
	this.textBuffer.delete( 1 ) ;
	this.runStateMachine() ;
	this.cursorHint() ;
	this.draw() ;
} ;



Neon.userAction.backDelete = function backDelete()
{
	this.textBuffer.backDelete( 1 ) ;
	this.runStateMachine() ;
	this.cursorHint() ;
	if ( ! this.followCursor() ) { this.draw() ; }
} ;



Neon.userAction.tab = function tab()
{
	this.textBuffer.insert( '\t' ) ;
	this.runStateMachine() ;
	this.cursorHint() ;
	if ( ! this.followCursor() ) { this.draw() ; }
} ;



Neon.userAction.halfPageUp = function halfPageUp()
{
	var delta = - Math.ceil( this.screenBuffer.height / 2 ) ;
	
	this.textBuffer.y = Math.min(
		0 ,
		this.textBuffer.y - delta
	) ;
	
	this.textBuffer.move( 0 , delta ) ;
	this.cursorHint() ;
	if ( ! this.followCursor() ) { this.draw() ; }
} ;



Neon.userAction.halfPageDown = function halfPageDown()
{
	var delta = Math.ceil( this.screenBuffer.height / 2 ) ;
	
	this.textBuffer.y = Math.max( 
		- this.textBuffer.textBuffer.length + delta ,
		this.textBuffer.y - delta 
	) ;
	
	this.textBuffer.move( 0 , delta ) ;
	if ( this.textBuffer.cy > this.textBuffer.textBuffer.length ) { this.textBuffer.cy = this.textBuffer.textBuffer.length ; }
	this.cursorHint() ;
	if ( ! this.followCursor() ) { this.draw() ; }
} ;



Neon.userAction.save = function save()
{
	this.save() ;
} ;



Neon.userAction.open = function open()
{
	this.open() ;
} ;



Neon.userAction.terminate = function terminate()
{
	this.terminate() ;
} ;



Neon.userAction.redraw = function redraw()
{
	this.fullRedraw() ;
} ;



