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



// Internal?
EditorTextBox.prototype.removeTrailingSpaces = function( y , x , changeDataIsInternal = false , changeDataList = [] ) {
	var deletedString = this.textBuffer.removeTrailingSpaces( y , x - 1 , true ) ;
	//console.error( "Auto-remove trailing space: '" + string.escape.control( deletedString ) + "'" ) ;

	if ( deletedString ) {
		let deleted = this.textBuffer.backDelete( deletedString.length , true ) ;

		if ( deleted ) {
			changeDataList.push( {
				type: 'backDelete' ,
				internal: changeDataIsInternal ,
				count: deleted.count ,
				deletedString: deleted.string ,
				startPosition: { x , y } ,
				endPosition: { x: this.textBuffer.cx , y: this.textBuffer.cy }
			} ) ;

			x = this.textBuffer.cx ;
			y = this.textBuffer.cy ;
		}
	}
} ;



EditorTextBox.prototype.addLinesIndentSteps = function( ymin , ymax , additionalSteps = 1 , selectIt = false , internal = false ) {
	var changeDataList = [] ,
		cx = this.textBuffer.cx ,
		cy = this.textBuffer.cy ;

	// TextBuffer optimization: avoid computing if the selection get deleted, which happens for each line
	if ( selectIt ) { this.textBuffer.selectionRegion = null ; }

	for ( let y = ymin ; y <= ymax ; y ++ ) {
		this.addLineIndentSteps( y , additionalSteps , true , changeDataList ) ;
	}

	if ( selectIt ) {
		this.textBuffer.setSelectionRegion( {
			xmin: 0 , ymin , xmax: this.textBuffer.buffer[ ymax ]?.length - 1 , ymax
		} ) ;
	}

	// Restore the cursor
	this.textBuffer.cx = cx ;
	this.textBuffer.cy = cy ;

	if ( changeDataList.length && ! internal ) {
		if ( this.stateMachine ) {
			this.textBuffer.runStateMachine() ;
		}

		this.autoScrollAndDraw() ;

		changeDataList[ changeDataList.length - 1 ].internal = false ;
		changeDataList.forEach( changeData => this.emit( 'change' , changeData ) ) ;
	}
} ;



EditorTextBox.prototype.addLineIndentSteps = function( y , additionalSteps , internal = false , changeDataList = null ) {
	var currentIndentStr = this.textBuffer.getLineIndent( y ) ;

	// Empty line? Exit!
	if ( currentIndentStr === null ) { return ; }

	var tabs = 0 , spaces = 0 ;

	for ( let char of currentIndentStr ) {
		if ( char === '\t' ) { tabs ++ ; }
		else if ( char === ' ' ) { spaces ++ ; }
	}

	var currentSteps = tabs + Math.round( spaces / ( this.indentWithSpaces || this.tabWidth ) ) ,
		//expectedIndentStr = this.indentStepStr.repeat( currentSteps ) ,
		wantedSteps = Math.max( 0 , currentSteps + additionalSteps ) ,
		wantedIndentStr = this.indentStepStr.repeat( wantedSteps ) ;

	if ( currentIndentStr === wantedIndentStr ) { return ; }	// Nothing to change

	this.textBuffer.cy = y ;
	this.updateLineIndentStr( y , wantedIndentStr , currentIndentStr , internal , changeDataList ) ;

	if ( changeDataList.length && ! internal ) {
		if ( this.stateMachine ) {
			this.textBuffer.runStateMachine() ;
		}

		this.autoScrollAndDraw() ;

		changeDataList[ changeDataList.length - 1 ].internal = false ;
		if ( changeDataList ) { changeDataList.forEach( changeData => this.emit( 'change' , changeData ) ) ; }
	}
} ;



// Internal
EditorTextBox.prototype.updateLineIndentStr = function( y , wantedIndentStr , currentIndentStr , changeDataIsInternal = false , changeDataList = [] ) {
	var x = this.textBuffer.cx = 0 ;
	y = y ?? this.textBuffer.cy ;

	currentIndentStr = currentIndentStr ?? ( this.textBuffer.getLineIndent() || '' ) ;
	//console.error( "autoIndent: '" + string.escape.control( currentIndentStr ) + "' ; '" + string.escape.control( wantedIndentStr ) + "'" ) ;

	if ( currentIndentStr === wantedIndentStr ) { return ; }

	var count = this.textBuffer.insert( wantedIndentStr ) ;
	var insertedString = wantedIndentStr ;

	var insertChangeData = {
		type: 'insert' ,
		internal: changeDataIsInternal ,
		insertedString ,
		count ,
		startPosition: { x , y } ,
		endPosition: { x: this.textBuffer.cx , y: this.textBuffer.cy }
	} ;

	changeDataList.push( insertChangeData ) ;
	if ( ! currentIndentStr ) { return changeDataList ; }

	insertChangeData.internal = true ;
	x = this.textBuffer.cx ;
	y = this.textBuffer.cy ;
	let deleted = this.textBuffer.delete( currentIndentStr.length , true ) ;

	var deleteChangeData = {
		type: 'delete' ,
		internal: changeDataIsInternal ,
		count: deleted.count ,
		deletedString: deleted.string ,
		startPosition: { x , y } ,
		endPosition: { x: this.textBuffer.cx , y: this.textBuffer.cy }
	} ;

	changeDataList.push( deleteChangeData ) ;
	return changeDataList ;
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
	var changeDataList = [] ,
		x = this.textBuffer.cx ,
		y = this.textBuffer.cy ;


	if ( this.autoRemoveTrailingSpaces ) {
		this.removeTrailingSpaces( y , x , true , changeDataList ) ;
		x = this.textBuffer.cx ;
		y = this.textBuffer.cy ;
	}


	this.textBuffer.newLine() ;
	changeDataList.push( {
		type: 'insert' ,
		insertedString: '\n' ,
		count: 1 ,
		startPosition: { x , y } ,
		endPosition: { x: this.textBuffer.cx , y: this.textBuffer.cy }
	} ) ;
	x = this.textBuffer.cx ;
	y = this.textBuffer.cy ;


	if ( this.autoIndent ) {
		let wantedIndentStr = this.getAutoIndentStr() ;
		this.updateLineIndentStr( y , wantedIndentStr , undefined , true , changeDataList ) ;
		x = this.textBuffer.cx ;
		y = this.textBuffer.cy ;
	}

	if ( this.stateMachine ) {
		this.textBuffer.runStateMachine() ;
	}

	this.autoScrollAndDraw() ;

	// The last 'change' event is not internal
	changeDataList[ changeDataList.length - 1 ].internal = false ;
	// Emit all 'change' events
	changeDataList.forEach( changeData => this.emit( 'change' , changeData ) ) ;
} ;

userActions.tab = function() {
	if ( this.textBuffer.selectionRegion && this.textBuffer.isInSelection() ) {
		this.addLinesIndentSteps( this.textBuffer.selectionRegion.ymin , this.textBuffer.selectionRegion.ymax , 1 , true ) ;
		return ;
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

userActions.untab = function() {
	if ( this.textBuffer.selectionRegion && this.textBuffer.isInSelection() ) {
		this.addLinesIndentSteps( this.textBuffer.selectionRegion.ymin , this.textBuffer.selectionRegion.ymax , -1 , true ) ;
		return ;
	}

	// What should untab do when we are not inside a selection???
} ;

