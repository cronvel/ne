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
	A modified EditableTextBox, most notably with the autoIndent feature.
*/



const termkit = require( 'terminal-kit' ) ;
const Element = termkit.Element ;
const EditableTextBox = termkit.EditableTextBox ;

const string = require( 'string-kit' ) ;



function EditorTextBox( options = {} ) {
	// Clone options if necessary
	options = ! options ? {} : options.internal ? options : Object.create( options ) ;
	options.internal = true ;

	EditableTextBox.call( this , options ) ;

	this.autoIndent = !! options.autoIndent ;
	this.autoRemoveTrailingSpaces = !! options.autoRemoveTrailingSpaces ;

	this.initChildren() ;

	if ( this.setContent === EditorTextBox.prototype.setContent ) {
		this.setContent( options.content , options.contentHasMarkup , true ) ;
	}

	// Only draw if we are not a superclass of the object
	if ( this.elementType === 'EditorTextBox' && ! options.noDraw ) { this.draw() ; }
}

module.exports = EditorTextBox ;
Element.inherit( EditorTextBox , EditableTextBox ) ;
// To be called immediately after a new line



// Internal
// Return the left part (relative to the cursor) of the autoIndent (the cursor must be at x=0, i.e. called just after a newLine)
EditorTextBox.prototype.getAutoIndentStr = function() {
	var indentStr = null ,
		y = this.textBuffer.cy ;

	if ( ! this.autoIndent || this.textBuffer.x !== 0 ) { return ; }

	while ( -- y >= 0 && indentStr === null ) {
		indentStr = this.textBuffer.getLineIndent( y ) ;
	}

	return indentStr ;
} ;



// User Actions

const userActions = EditorTextBox.prototype.userActions ;

userActions.newLine = function() {
	var insertChangeData , preDeleteChangeData , postDeleteChangeData ,
		insertedString = '\n' ,
		count = 1 ,
		x = this.textBuffer.cx ,
		y = this.textBuffer.cy ;

	if ( this.autoRemoveTrailingSpaces ) {
		let deletedString = this.textBuffer.removeTrailingSpaces( y , x , true ) ;
		console.error( "Auto-remove trailing space: '" + string.escape.control( deletedString ) + "'" ) ;
		
		if ( deletedString ) {
			let deleted = this.textBuffer.backDelete( deletedString.length , true ) ;

			if ( deleted ) {
				preDeleteChangeData = {
					type: 'backDelete' ,
					count: deleted.count ,
					deletedString: deleted.string ,
					startPosition: { x , y } ,
					endPosition: { x: this.textBuffer.cx , y: this.textBuffer.cy }
				} ;

				x = this.textBuffer.cx ;
				y = this.textBuffer.cy ;
			}
		}
	}

	this.textBuffer.newLine() ;

	if ( this.autoIndent ) {
		let currentIndent = this.textBuffer.getLineIndent() ;
		let wantedIndent = this.getAutoIndentStr() ;
		console.error( "autoIndent: '" + string.escape.control( currentIndent ) + "' / '" + string.escape.control( wantedIndent ) + "'" ) ;

		if ( currentIndent !== wantedIndent ) {
			count += this.textBuffer.insert( wantedIndent ) ;
			insertedString += wantedIndent ;

			insertChangeData = {
				type: 'insert' ,
				insertedString ,
				count ,
				startPosition: { x , y } ,
				endPosition: { x: this.textBuffer.cx , y: this.textBuffer.cy }
			} ;

			if ( currentIndent ) {
				insertChangeData.internal = true ;
				x = this.textBuffer.cx ;
				y = this.textBuffer.cy ;
				let deleted = this.textBuffer.delete( currentIndent.length , true ) ;

				postDeleteChangeData = {
					type: 'delete' ,
					count: deleted.count ,
					deletedString: deleted.string ,
					startPosition: { x , y } ,
					endPosition: { x: this.textBuffer.cx , y: this.textBuffer.cy }
				} ;
			}
		}
	}

	if ( ! insertChangeData ) {
		insertChangeData = {
			type: 'insert' ,
			insertedString ,
			count ,
			startPosition: { x , y } ,
			endPosition: { x: this.textBuffer.cx , y: this.textBuffer.cy }
		} ;
	}


	if ( this.stateMachine ) {
		this.textBuffer.runStateMachine() ;
	}

	this.autoScrollAndDraw() ;

	if ( preDeleteChangeData ) { this.emit( 'change' , preDeleteChangeData ) ; }
	this.emit( 'change' , insertChangeData ) ;
	if ( postDeleteChangeData ) { this.emit( 'change' , postDeleteChangeData ) ; }
} ;

