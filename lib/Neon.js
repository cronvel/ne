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
	this.contextBar( 'Open: ' , null , true ) ;
	
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
			self.contextBar( 'Ok then...' , 2000 ) ;
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
			
			self.contextBar( 'Loaded!' , 2000 ) ;
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
	this.contextBar( 'Save to: ' , null , true ) ;
	
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
			self.contextBar( 'Ok then...' , 2000 ) ;
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
			
			self.contextBar( 'Saved!' , 2000 ) ;
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
		if ( ! this.followCursor() ) { this.draw() ; }
	}
	else if ( this.keyBindings[ key ] )
	{
		// User interactions are disabled (file loading, etc), except the 'terminate' action
		if ( this.pauseMainUserEvent && this.keyBindings[ key ] !== 'terminate' ) { return ; }
		
		Neon.userAction[ this.keyBindings[ key ] ].call( this ) ;
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
	
	this.term.moveTo( this.x , this.statusBarY ).bgWhite.blue.eraseLine( str ) ;
	
	this.drawCursor() ;
} ;



Neon.prototype.contextBar = function contextBar( str , timeout , doNotDrawCursor )
{
	if ( ! this.hasContextBar ) { return ; }
	
	if ( typeof str !== 'string' ) { str = this.contextBarText ; }
	else { this.contextBarText = str ; }
	
	this.term.moveTo( this.x , this.contextBarY ).bgWhite.blue.eraseLine( str ) ;
	
	if ( ! doNotDrawCursor ) { this.drawCursor() ; }
	
	if ( timeout ) { setTimeout( contextBar.bind( this , '' ) , timeout ) ; }
} ;



// Temp:
var scrollContextLine = 3 ;
var scrollContextColumn = 10 ;

Neon.prototype.followCursor = function followCursor()
{
	var oldX = this.textBuffer.x ,
		oldY = this.textBuffer.y ;
	
	if ( this.textBuffer.x < - this.textBuffer.cx + scrollContextColumn )
	{
		this.textBuffer.x = Math.min( 0 , - this.textBuffer.cx + scrollContextColumn ) ;
	}
	else if ( this.textBuffer.x > - this.textBuffer.cx + this.screenBuffer.width - scrollContextColumn - 1 )
	{
		this.textBuffer.x = - this.textBuffer.cx + this.screenBuffer.width - scrollContextColumn - 1 ;
	}
	
	if ( this.textBuffer.y < - this.textBuffer.cy + scrollContextLine )
	{
		this.textBuffer.y = Math.min( 0 , - this.textBuffer.cy + scrollContextLine ) ;
	}
	else if ( this.textBuffer.y > - this.textBuffer.cy + this.screenBuffer.height - scrollContextLine - 1 )
	{
		this.textBuffer.y = - this.textBuffer.cy + this.screenBuffer.height - scrollContextLine - 1 ;
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
	CTRL_C: 'terminate'
} ;

Neon.userAction = {} ;

Neon.userAction.up = function up()
{
	this.textBuffer.moveUp() ;
	if ( ! this.followCursor() ) { this.drawCursor() ; }
} ;



Neon.userAction.down = function down()
{
	this.textBuffer.moveDown() ;
	if ( ! this.followCursor() ) { this.drawCursor() ; }
} ;



Neon.userAction.backward = function backward()
{
	this.textBuffer.moveBackward() ;
	if ( ! this.followCursor() ) { this.drawCursor() ; }
} ;



Neon.userAction.forward = function forward()
{
	this.textBuffer.moveForward() ;
	if ( ! this.followCursor() ) { this.drawCursor() ; }
} ;



Neon.userAction.endOfLine = function endOfLine()
{
	this.textBuffer.moveToEndOfLine() ;
	if ( ! this.followCursor() ) { this.drawCursor() ; }
} ;



Neon.userAction.startOfLine = function startOfLine()
{
	this.textBuffer.moveToColumn( 0 ) ;
	if ( ! this.followCursor() ) { this.drawCursor() ; }
} ;



Neon.userAction.newLine = function newLine()
{
	this.textBuffer.newLine() ;
	this.runStateMachine() ;
	if ( ! this.followCursor() ) { this.draw() ; }
} ;



Neon.userAction.delete = function delete_()
{
	this.textBuffer.delete( 1 ) ;
	this.runStateMachine() ;
	this.draw() ;
} ;



Neon.userAction.backDelete = function backDelete()
{
	this.textBuffer.backDelete( 1 ) ;
	this.runStateMachine() ;
	if ( ! this.followCursor() ) { this.draw() ; }
} ;



Neon.userAction.tab = function tab()
{
	this.textBuffer.insert( '\t' ) ;
	this.runStateMachine() ;
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
	return ;
} ;



