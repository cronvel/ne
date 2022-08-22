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
const term = termkit.terminal ;
const TextEditor = require( './TextEditor.js' ) ;



async function cli() {
	var args = require( 'minimist' )( process.argv.slice( 2 ) ) ;
	
	if ( args.old ) {
		// old
		const OldNeon = require( './Neon_old.js' ) ;
		let neon = new OldNeon( { standAlone: true } ) ;
		neon.run() ;
	
		if ( args._.length ) { neon.openFile( args._[ 0 ] ) ; }
		return ;
	}


	term.clear() ;

	let document = term.createDocument( {
		//  backgroundAttr: { bgColor: 'magenta' , dim: true } ,
	} ) ;

	let textEditor = new TextEditor( {
		parent: document ,
		x: 0 ,
		y: 0 ,
		width: term.width ,
		height: term.height
	} ) ;

	term.on( 'key' , key => {
		if ( key === 'CTRL_C' ) {
			term.grabInput( false ) ;
			term.hideCursor( false ) ;
			term.styleReset() ;
			term.clear() ;
			process.exit() ;
		}
	} ) ;
}

module.exports = cli ;

