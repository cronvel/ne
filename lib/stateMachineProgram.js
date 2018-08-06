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



var idleStyle = { color: 'white' } ;
var keywordStyle = { color: 'brightWhite' , bold: true } ;
var constantKeywordStyle = { color: 'brightBlue' , bold: true } ;
var constantStyle = { color: 'brightBlue' } ;
var identifierStyle = { color: 'red' } ;
var numberStyle = { color: 'cyan' } ;
var stringStyle = { color: 'blue' } ;
var escapeStyle = { color: 'brightCyan' , bold: true } ;
var commentStyle = { color: 'brightBlack' } ;
var propertyStyle = { color: 'green' } ;
var methodStyle = { color: 'brightYellow' } ;
var coreMethodStyle = { color: 'brightYellow' , bold: true } ;
var classStyle = { color: 'magenta' } ;
var coreClassOrObjectStyle = { color: 'brightMagenta' , bold: true } ;

var parseErrorStyle = { color: 'brightWhite' , bgColor: 'red' , bold: true } ;
var braceStyle = { color: 'brightWhite' , bold: true } ;



var keywords = [
	'do' , 'if' , 'in' , 'for' , 'let' , 'new' , 'try' , 'var' , 'case' , 'else' , 'enum' ,
	'eval' , 'this' , 'void' , 'with' , 'await' , 'break' , 'catch' , 'class' , 'const' ,
	'super' , 'throw' , 'while' , 'yield' , 'delete' , 'export' , 'import' , 'public' , 'return' ,
	'static' , 'switch' , 'typeof' , 'default' , 'extends' , 'finally' , 'package' , 'private' ,
	'continue' , 'debugger' , 'function' , 'arguments' , 'interface' , 'protected' , 'implements' , 'instanceof' ,

	// Node pseudo keywords
	'exports' , 'global' , 'module' , 'require' , '__filename' , '__dirname'
] ;

var constantKeywords = [
	'true' , 'false' , 'null' , 'undefined' , 'Infinity' , 'NaN'
] ;

var coreMethods = [
	'setTimeout' , 'clearTimeout' , 'setInterval' , 'clearInterval' , 'setImmediate' , 'clearImmediate' ,
	'isNaN' , 'isFinite' , 'parseInt' , 'parseFloat' ,

	// Node
	'unref' , 'ref'
] ;

var coreClassesOrObjects = [
	'Array' , 'Boolean' , 'Date' , 'Error' , 'Function' , 'Intl' , 'Math' , 'Number' , 'Object' , 'String' , 'RegExp' ,
	'EvalError' , 'RangeError' , 'ReferenceError' , 'SyntaxError' , 'TypeError' ,
	'ArrayBuffer' , 'Float32Array' , 'Float64Array' , 'Int16Array' , 'Int32Array' ,
	'Int8Array' , 'Uint16Array' , 'Uint32Array' , 'Uint8Array' ,

	// Common
	'console' , 'JSON' ,

	// Node
	'process' , 'Buffer' ,

	// Browser
	'window' , 'document' , 'Window' , 'Image' , 'DataView' , 'URIError'
] ;

var memberKeywords = [
	'prototype' , 'constructor'
] ;



var coreMethodHints = {
	setTimeout: 'timerID = setTimeout( callback , ms )' ,
	clearTimeout: 'clearTimeout( timerID )' ,
	setInterval: 'timerID = setInterval( callback , ms )' ,
	clearInterval: 'clearInterval( timerID )' ,
	parseInt: 'number = parseInt( string , radix )'
} ;





var prog = {
	hostConfig: {	// Accessible by the host
	} ,
	config: {
		initState: 'idle'
	} ,
	states: {	// Every states of the machine
		idle: {
			action: [ 'style' , idleStyle ] ,	// action when this state is active at the end of the event
			buffer: false ,					// if true, this state start buffering as long as it last
			//checkpoint: true ,	// true if the past will not have influence on the future anymore: help optimizing the host
			events: [
				{
					trigger: /^[a-zA-Z_$]/ ,	// the event should match this to trigger those actions
					state: 'identifier' ,	// next state

					propagate: false ,		// eat the event or propagate it immediately to the next state?
					action: null ,			// action at trigger time, run before the action of the next state
					delay: false 			// for this time, the old state action will be executed rather than the new one
				} ,
				{
					trigger: /^[0-9]/ ,
					state: 'number'
				} ,
				{
					trigger: '"' ,
					state: 'doubleQuoteString'
				} ,
				{
					trigger: "'" ,
					state: 'singleQuoteString'
				} ,
				{
					trigger: '/' ,
					state: 'idleSlash'
				} ,
				{
					trigger: '{' ,
					state: 'openBrace'
				} ,
				{
					trigger: '}' ,
					state: 'closeBrace'
				} ,
				{
					trigger: '[' ,
					state: 'openBracket'
				} ,
				{
					trigger: ']' ,
					state: 'closeBracket'
				} ,
				{
					trigger: '(' ,
					state: 'openParenthesis'
				} ,
				{
					trigger: ')' ,
					state: 'closeParenthesis'
				}
			]
		} ,
		identifier: {
			action: [ 'style' , identifierStyle ] ,
			events: [
				{
					trigger: /^[a-zA-Z0-9_$]/ ,
					state: 'identifier'
				} ,
				{
					trigger: true ,
					state: 'afterIdentifier' ,
					propagate: true ,
					continue: true
				}
			] ,
			buffer: [
				{
					trigger: keywords ,
					// replace the 'action' of the event, also work with any properties of the event except 'trigger' BTW
					action: [ 'blockStyle' , keywordStyle ] ,
					state: 'idle'
				} ,
				{
					trigger: constantKeywords ,
					action: [ 'blockStyle' , constantKeywordStyle ] ,
					state: 'idle'
				} ,
				{
					trigger: coreMethods ,
					action: [ [ 'blockStyle' , coreMethodStyle ] , [ 'hint' , coreMethodHints ] ] ,
					state: 'idle'
				} ,
				{
					trigger: coreClassesOrObjects ,
					action: [ 'blockStyle' , coreClassOrObjectStyle ] ,
					state: 'afterIdentifier' ,
					propagate: true ,
					continue: true
				} ,
				{
					trigger: function( str ) { return str.search( /^[A-Z][A-Z0-9_]+$/ ) !== -1 ; } ,
					action: [ 'blockStyle' , constantStyle ] ,
					state: 'afterIdentifier' ,
					propagate: true ,
					continue: true
				} ,
				{
					trigger: function( str ) { return str.search( /^[A-Z]/ ) !== -1 ; } ,
					action: [ 'blockStyle' , classStyle ] ,
					state: 'afterIdentifier' ,
					propagate: true ,
					continue: true
				}
			]
		} ,
		number: {
			action: [ 'style' , numberStyle ] ,
			events: [
				{
					trigger: /^[0-9.]/ ,
					state: 'number'
				} ,
				{
					trigger: true ,
					state: 'idle' ,
					propagate: true
				}
			]
		} ,



		singleQuoteString: {
			action: [ 'style' , stringStyle ] ,
			events: [
				{
					trigger: /^\\/ ,
					state: 'escape'
				} ,
				{
					trigger: /^['\n]/ ,
					state: 'idle' ,
					delay: true
				}
			]
		} ,
		doubleQuoteString: {
			action: [ 'style' , stringStyle ] ,
			events: [
				{
					trigger: /^\\/ ,
					state: 'escape'
				} ,
				{
					trigger: /^["\n]/ ,
					state: 'idle' ,
					delay: true
				}
			]
		} ,



		openBrace: {
			subProgram: true ,
			action: [ 'style' , parseErrorStyle ] ,
			events: [
				{
					trigger: true ,
					state: 'idle' ,
					propagate: true
				}
			]
		} ,
		closeBrace: {
			action: [ 'style' , braceStyle ] ,
			events: [
				{
					trigger: true ,
					return: 'openBrace' ,	// return, expecting returning from the 'openBrace' subProgram
					action: [ 'openingStyle' , braceStyle ] ,
					errorAction: [ 'style' , parseErrorStyle ] ,
					state: 'idle' ,
					propagate: true
				}
			]
		} ,
		openBracket: {
			subProgram: true ,
			action: [ 'style' , parseErrorStyle ] ,
			events: [
				{
					trigger: true ,
					state: 'idle' ,
					propagate: true
				}
			]
		} ,
		closeBracket: {
			action: [ 'style' , braceStyle ] ,
			events: [
				{
					trigger: true ,
					return: 'openBracket' ,
					action: [ 'openingStyle' , braceStyle ] ,
					errorAction: [ 'style' , parseErrorStyle ] ,
					state: 'idle' ,
					propagate: true
				}
			]
		} ,
		openParenthesis: {
			subProgram: true ,
			action: [ 'style' , parseErrorStyle ] ,
			events: [
				{
					trigger: true ,
					state: 'idle' ,
					propagate: true
				}
			]
		} ,
		closeParenthesis: {
			action: [ 'style' , braceStyle ] ,
			events: [
				{
					trigger: true ,
					return: 'openParenthesis' ,
					action: [ 'openingStyle' , braceStyle ] ,
					errorAction: [ 'style' , parseErrorStyle ] ,
					state: 'idle' ,
					propagate: true
				}
			]
		} ,



		afterIdentifier: {
			action: [ 'style' , idleStyle ] ,
			events: [
				{
					trigger: ' ' ,
					state: 'afterIdentifier'
				} ,
				{
					trigger: '.' ,
					state: 'dotAfterIdentifier'
				} ,
				{
					trigger: '(' ,
					state: 'openParenthesis' ,
					action: [ 'blockStyle' , methodStyle ]
				} ,
				{
					trigger: true ,
					state: 'idle' ,
					propagate: true
				}
			]
		} ,
		dotAfterIdentifier: {
			action: [ 'style' , idleStyle ] ,
			events: [
				{
					trigger: ' ' ,
					state: 'dotAfterIdentifier'
				} ,
				{
					trigger: /^[a-zA-Z_$]/ ,
					state: 'member'
				} ,
				{
					trigger: true ,
					state: 'idle' ,
					propagate: true
				}
			]
		} ,
		member: {
			action: [ 'style' , propertyStyle ] ,
			events: [
				{
					trigger: /^[a-zA-Z0-9_$]/ ,
					state: 'member'
				} ,
				{
					trigger: true ,
					state: 'afterIdentifier' ,
					propagate: true ,
					continue: true		// continue the block
				}
			] ,
			// Checked when an event would change the state
			buffer: [
				{
					trigger: memberKeywords ,
					// replace the 'action' of the event, also work with any properties of the event except 'trigger' BTW
					action: [ 'blockStyle' , keywordStyle ] ,
					state: 'afterIdentifier' ,
					propagate: true
				}
			]
		} ,



		idleSlash: {
			action: [ 'style' , idleStyle ] ,
			events: [
				{
					trigger: '/' ,
					state: 'lineComment' ,
					action: [ 'style' , commentStyle ]
				} ,
				{
					trigger: '*' ,
					state: 'multiLineComment' ,
					action: [ 'style' , commentStyle ]
				} ,
				{
					trigger: true ,
					state: 'idle'
				}
			]
		} ,
		lineComment: {
			action: [ 'style' , commentStyle ] ,
			events: [
				{
					trigger: '\n' ,
					state: 'idle'
				}
			]
		} ,
		multiLineComment: {
			action: [ 'style' , commentStyle ] ,
			events: [
				{
					trigger: '*' ,
					state: 'multiLineCommentAsterisk'
				}
			]
		} ,
		multiLineCommentAsterisk: {
			action: [ 'style' , commentStyle ] ,
			events: [
				{
					trigger: '/' ,
					state: 'idle' ,
					delay: true
				} ,
				{
					trigger: true ,
					state: 'multiLineComment' ,
					propagate: true
				}
			]
		} ,






		escape: {
			subProgram: true ,
			action: [ 'style' , escapeStyle ] ,
			events: [
				{
					trigger: true ,
					return: true ,
					state: 'idle' ,		// This is ignored if the current state can return
					delay: true
				}
			]
		}
	}
} ;



module.exports = prog ;


