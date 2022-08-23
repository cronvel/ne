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

const Promise = require( 'seventh' ) ;



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

	this.welcomeAnimation() ;
	this.textEditor.setContextBar( 'Ctrl-C to quit' ) ;
	
	this.document.giveFocusTo( this.textEditor ) ;
} ;



const NEON_ANIMATION = [
	'Neon' ,
	'^bNe^mo^rn' ,
	'^bN^meo^rn' ,
	'^bN^me^ron' ,
	'^BNe^mo^rn' ,
	'^BN^meo^rn' ,
	'^BN^me^ron' ,
	'^bNe^Mo^rn' ,
	'^bN^Meo^rn' ,
	'^bN^Me^ron' ,
	'^bNe^mo^Rn' ,
	'^bN^meo^Rn' ,
	'^bN^me^Ron' ,

	'^+^BN^Me^:^Ron' ,

	'^+^GNe^:^Yon' ,
] ;

Neon.prototype.welcomeAnimation = async function() {
	this.textEditor.setStatusBar( '  ^bWelcome to Neon!' ) ;

	for ( let count = 0 ; count < 20 ; count ++ ) {
		let anim = NEON_ANIMATION[ Math.floor( Math.random() * NEON_ANIMATION.length ) ] ;
		this.textEditor.setStatusBar( '  ^bWelcome to ' + anim + '^:^b!' ) ;
		await Promise.resolveTimeout( 200 + Math.random() * 500 ) ;
	}
} ;



Neon.prototype.openFile = function( filePath , createIfNotExist = false ) {
	return this.textEditor.openFile( filePath , createIfNotExist ) ;
} ;







// DEPRECATED?

Neon.prototype.onTerminal = function( name , data ) {
	if ( name === 'SCREEN_RESIZE' && this.standAlone ) {
		this.resize( data.width , data.height ) ;
	}
} ;

