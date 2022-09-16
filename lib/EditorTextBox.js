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

	this.indentWithSpaces = null ;	// number or null, if number: use that many spaces to indent, if falsy: use one tab to indent
	this.indentStepStr = '' ;
	this.setIndentWithSpaces( options.indentWithSpaces ) ; 
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



EditorTextBox.prototype.setIndentWithSpaces = function( indentWithSpaces ) {
	this.indentWithSpaces = + indentWithSpaces || null ;
	if ( this.indentWithSpaces < 0 ) { this.indentWithSpaces = null ; }
	this.indentStepStr = this.indentWithSpaces ? ' '.repeat( this.indentWithSpaces ) : '\t' ;
} ;



EditorTextBox.prototype.addRegionIndentSteps = function( region , additionalSteps = 1 ) {
	for ( let y = region.ymin ; y <= region.ymax ; y ++ ) {
		this.addLineIndentSteps( y , additionalSteps ) ;
	}
} ;



EditorTextBox.prototype.addLineIndentSteps = function( y , additionalSteps , internal = false ) {
	var currentIndentStr = this.textBuffer.getLineIndent( y ) ;
	
	// Empty line? Exit!
	if ( currentIndentStr === null ) { return ; }
	
	var tabs = 0 , spaces = 0 ;

	for ( let char of currentIndentStr ) {
		if ( char === '\t' ) { tabs ++ ; }
		else if ( char === ' ' ) { spaces ++ ; }
	}
	
	var currentSteps = tabs + Math.round( spaces / ( this.indentWithSpaces || this.tabWidth ) ) ,
		expectedIndentStr = this.indentStepStr.repeat( currentSteps ) ,
		wantedSteps = Math.max( 0 , currentSteps + additionalSteps ) ,
		wantedIndentStr = this.indentStepStr.repeat( wantedSteps ) ;
	
	if ( currentIndentStr === wantedIndentStr ) { return ; }	// Nothing to change

	this.textBuffer.cy = y ;
	var changeDataList = this.updateLineIndentStr( y , wantedIndentStr , currentIndentStr , internal ) ;
	
	if ( ! internal ) {
		if ( this.stateMachine ) {
			this.textBuffer.runStateMachine() ;
		}

		this.autoScrollAndDraw() ;

		if ( changeDataList ) { changeDataList.forEach( changeData => this.emit( 'change' , changeData ) ) ; }
	}
} ;



// Internal
EditorTextBox.prototype.updateLineIndentStr = function( y , wantedIndentStr , currentIndentStr , internalChangeData = false ) {
	var x = this.textBuffer.x = 0 ;
	y = y ?? this.textBuffer.cy ;

	currentIndentStr = currentIndentStr ?? this.textBuffer.getLineIndent() || '' ;
	//console.error( "autoIndent: '" + string.escape.control( currentIndentStr ) + "' ; '" + string.escape.control( wantedIndentStr ) + "'" ) ;

	if ( currentIndentStr === wantedIndentStr ) { return ; }

	count += this.textBuffer.insert( wantedIndentStr ) ;
	insertedString += wantedIndentStr ;

	var insertChangeData = {
		type: 'insert' ,
		internal: internalChangeData ,
		insertedString ,
		count ,
		startPosition: { x , y } ,
		endPosition: { x: this.textBuffer.cx , y: this.textBuffer.cy }
	} ;

	if ( ! currentIndentStr ) { return [ insertChangeData ] ; }

	insertChangeData.internal = true ;
	x = this.textBuffer.cx ;
	y = this.textBuffer.cy ;
	let deleted = this.textBuffer.delete( currentIndentStr.length , true ) ;

	var deleteChangeData = {
		type: 'delete' ,
		internal: internalChangeData ,
		count: deleted.count ,
		deletedString: deleted.string ,
		startPosition: { x , y } ,
		endPosition: { x: this.textBuffer.cx , y: this.textBuffer.cy }
	} ;
	
	return [ insertChangeData , deleteChangeData ] ;
} ;



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
		let deletedString = this.textBuffer.removeTrailingSpaces( y , x - 1 , true ) ;
		//console.error( "Auto-remove trailing space: '" + string.escape.control( deletedString ) + "'" ) ;

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
		let currentIndentStr = this.textBuffer.getLineIndent() || '' ;
		let wantedIndentStr = this.getAutoIndentStr() ;
		//console.error( "autoIndent: '" + string.escape.control( currentIndentStr ) + "' ; '" + string.escape.control( wantedIndentStr ) + "'" ) ;

		if ( currentIndentStr !== wantedIndentStr ) {
			count += this.textBuffer.insert( wantedIndentStr ) ;
			insertedString += wantedIndentStr ;

			insertChangeData = {
				type: 'insert' ,
				insertedString ,
				count ,
				startPosition: { x , y } ,
				endPosition: { x: this.textBuffer.cx , y: this.textBuffer.cy }
			} ;

			if ( currentIndentStr ) {
				insertChangeData.internal = true ;
				x = this.textBuffer.cx ;
				y = this.textBuffer.cy ;
				let deleted = this.textBuffer.delete( currentIndentStr.length , true ) ;

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

userActions.tab = function() {
	if ( this.textBuffer.selectionRegion && this.textBuffer.isInSelection() ) {
		return this.indentRegion( this.textBuffer.selectionRegion ) ;
	}
	
	var x = this.textBuffer.cx ,
		y = this.textBuffer.cy ;

	this.textBuffer.insert( this.indentStepStr , this.textAttr ) ;
	if ( this.stateMachine ) {
		this.textBuffer.runStateMachine() ;
	}
	this.autoScrollAndDraw() ;
	this.emit( 'change' , {
		type: 'insert' ,
		insertedString: this.indentStepStr ,
		count: 1 ,
		internal: false ,
		startPosition: { x , y } ,
		endPosition: { x: this.textBuffer.cx , y: this.textBuffer.cy }
	} ) ;
} ;

