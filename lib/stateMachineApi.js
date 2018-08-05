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
var termKit = require( 'terminal-kit' ) ;



var api = {} ;
module.exports = api ; 



api.style = function apiStyle( style )
{
	if ( this.x === null ) { return ; }	// This is a newline or end of buffer character, there is no style to apply here
	if ( ! style.code ) { style.code = termKit.ScreenBuffer.object2attr( style ) ; }	// cache it now
	
	this.neon.textBuffer.setAttrCodeAt( style.code , this.x , this.y ) ;
} ;



api.altStyle = function apiAltStyle( style )
{
	if ( ! this.alt || this.alt.x === null ) { return ; }
	if ( ! style.code ) { style.code = termKit.ScreenBuffer.object2attr( style ) ; }
	
	this.neon.textBuffer.setAttrCodeAt( style.code , this.alt.x , this.alt.y ) ;
} ;

api.openingStyle = api.altStyle ;



api.blockStyle = function apiBlockStyle( style )
{
	//console.error( "Yo mes dos" , this.alt , !! ( this.alt && this.alt.x ) ) ;
	if ( this.x === null || ! this.alt || this.alt.x === null ) { return ; }
	if ( ! style.code ) { style.code = termKit.ScreenBuffer.object2attr( style ) ; }
	
	this.neon.textBuffer.setAttrCodeRegion( style.code , {
		xmin: this.alt.x ,
		xmax: this.x ,
		ymin: this.alt.y ,
		ymax: this.y
	} ) ;
} ;



api.hint = function apiHint( hints )
{
	var misc ;
	
	if ( hints[ this.buffer ] )
	{
		// /!\ WARNING! DOES NOT WORK IN MOST TIME!
		// Since Misc buffer has merged with other buffer, there is no misc at the end of line
		//misc = this.neon.textBuffer.getMiscAt( this.x + 1 , this.y ) ;
		misc = this.neon.textBuffer.getMiscAt( this.x , this.y ) ;
		if ( misc ) { misc.hint = hints[ this.buffer ] ; }
	}
} ;




