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
	} ) ;
	
	var screenBuffer = termKit.ScreenBuffer.create( {
		dst: neon.term ,
		width: options.width || neon.term.width ,
		height: options.height || ( neon.standAlone ? neon.term.height : neon.term.height - 1 ) ,
		x: options.x || 1 ,
		y: options.y || ( neon.standAlone ? 2 : 1 )
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
		stateMachine: { value: stateMachine , enumerable: true , writable: true } ,
	} ) ;
	
	return neon ;
} ;



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
	this.term.moveTo( 1 , 1 ).bgWhite.blue.eraseLine( 'Welcome to Neon!' ) ;
} ;



Neon.prototype.run = function run()
{
	if ( this.standAlone ) { this.standAloneInit() ; }
	
	this.textBuffer.setEmptyCellAttr( this.emptyCellAttr ) ;
	this.term.grabInput() ;
	
	// Finish init
	this.textBuffer.draw() ;
	this.screenBuffer.draw( { delta: true } ) ;
	
	// Display that at the bottom, it will be removed after the first user input (the next screenBuffer draw)
	this.term.moveTo( 1 , this.screenBuffer.y + this.screenBuffer.height - 1 ).bgWhite.green( 'CTRL-C to quit' ) ;
	
	this.textBuffer.drawCursor() ;
	this.screenBuffer.drawCursor() ;
	
	// Bind the 'key' event to the key handler
	this.term.on( 'key' , Neon.prototype.onKey.bind( this ) ) ;
} ;



Neon.prototype.onKey = function onKey( key , matches , data )
{
	var runStateMachine , draw , drawCursor ;
	
	if ( data.isCharacter )
	{
		this.textBuffer.insert( key , this.attr ) ;
		runStateMachine = draw = drawCursor = true ;
	}
	else
	{
		switch ( key )
		{
			case 'UP' :
				this.textBuffer.moveUp() ;
				drawCursor = true ;
				break ;
			case 'DOWN' :
				this.textBuffer.moveDown() ;
				drawCursor = true ;
				break ;
			case 'LEFT' :
				//this.textBuffer.move( -1 , 0 ) ;
				this.textBuffer.moveBackward() ;
				drawCursor = true ;
				break ;
			case 'RIGHT' :
				//this.textBuffer.move( 1 , 0 ) ;
				this.textBuffer.moveForward() ;
				drawCursor = true ;
				break ;
			case 'END' :
				this.textBuffer.moveToEndOfLine() ;
				drawCursor = true ;
				break ;
			case 'HOME' :
				this.textBuffer.moveToColumn( 0 ) ;
				drawCursor = true ;
				break ;
			case 'ENTER' :
				this.textBuffer.newLine() ;
				runStateMachine = draw = drawCursor = true ;
				break ;
			case 'DELETE' :
				this.textBuffer.delete( 1 ) ;
				runStateMachine = draw = drawCursor = true ;
				break ;
			case 'BACKSPACE' :
				this.textBuffer.backDelete( 1 ) ;
				runStateMachine = draw = drawCursor = true ;
				break ;
			case 'TAB' :
				this.textBuffer.insert( '\t' ) ;
				runStateMachine = draw = drawCursor = true ;
				break ;
			case 'CTRL_C' :
				this.terminate() ;
				break ;
		}
	}
	
	
	// Run the state machine if necessary
	if ( runStateMachine )
	{
		this.runStateMachine() ;
	}
	
	// Redraw if necessary
	if ( draw )
	{
		this.textBuffer.draw() ;
		this.screenBuffer.draw( { delta: true } ) ;
	}
	
	// Draw the cursor, i.e. move it on screen where the textBuffer cursor is
	if ( drawCursor )
	{
		this.textBuffer.drawCursor() ;
		this.screenBuffer.drawCursor() ;
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




