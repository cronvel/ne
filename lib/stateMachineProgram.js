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
var thisStyle = { color: 'brightRed' , bold: true } ;
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
	'eval' , 'void' , 'with' , 'await' , 'break' , 'catch' , 'class' , 'const' ,
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
			buffer: false ,					// if an array, this state start buffering as long as it last
			//checkpoint: true ,	// true if the past will not have influence on the future anymore: help optimizing the host
			events: [
				{
					match: /^[a-zA-Z_$]/ ,	// the event should match this to trigger those actions
					state: 'identifier' ,	// next state

					propagate: false ,		// eat the event or propagate it immediately to the next state?
					action: null ,			// action at trigger time, run before the action of the next state
					delay: false 			// for this time, the old state action will be executed rather than the new one
				} ,
				{
					match: /^[0-9]/ ,
					state: 'number'
				} ,
				{
					match: '"' ,
					state: 'doubleQuoteString'
				} ,
				{
					match: "'" ,
					state: 'singleQuoteString'
				} ,
				{
					match: '/' ,
					state: 'idleSlash'
				} ,
				{
					match: '{' ,
					state: 'openBrace'
				} ,
				{
					match: '}' ,
					state: 'closeBrace'
				} ,
				{
					match: '[' ,
					state: 'openBracket'
				} ,
				{
					match: ']' ,
					state: 'closeBracket'
				} ,
				{
					match: '(' ,
					state: 'openParenthesis'
				} ,
				{
					match: ')' ,
					state: 'closeParenthesis'
				}
			]
		} ,
		identifier: {
			action: [ 'style' , identifierStyle ] ,
			events: [
				{
					match: /^[a-zA-Z0-9_$]/ ,
					state: 'identifier'
				} ,
				{
					match: true ,
					state: 'afterIdentifier' ,
					propagate: true ,
					continue: true		// Keep the starting context
				}
			] ,
			// Buffers are checked on state switching
			buffer: [
				{
					match: 'this' ,
					// replace the 'action' of the event, also work with any properties of the event except 'match' BTW
					action: [ 'blockStyle' , thisStyle ] ,
					state: 'afterIdentifier'
					//propagate: true ,
					//continue: true
				} ,
				{
					match: keywords ,
					action: [ 'blockStyle' , keywordStyle ] ,
					state: 'idle'
				} ,
				{
					match: constantKeywords ,
					action: [ 'blockStyle' , constantKeywordStyle ] ,
					state: 'idle'
				} ,
				{
					match: coreMethods ,
					action: [ [ 'blockStyle' , coreMethodStyle ] , [ 'hint' , coreMethodHints ] ] ,
					state: 'idle'
				} ,
				{
					match: coreClassesOrObjects ,
					action: [ 'blockStyle' , coreClassOrObjectStyle ] ,
					state: 'afterIdentifier' ,
					propagate: true ,
					continue: true
				} ,
				{
					match: /^[A-Z][A-Z0-9_]+$/ ,
					action: [ 'blockStyle' , constantStyle ] ,
					state: 'afterIdentifier' ,
					propagate: true ,
					continue: true
				} ,
				{
					match: /^[A-Z]/ ,
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
					match: /^[0-9.]/ ,
					state: 'number'
				} ,
				{
					match: true ,
					state: 'idle' ,
					propagate: true
				}
			]
		} ,



		singleQuoteString: {
			action: [ 'style' , stringStyle ] ,
			events: [
				{
					match: /^\\/ ,
					state: 'escape'
				} ,
				{
					match: /^['\n]/ ,
					state: 'idle' ,
					delay: true
				}
			]
		} ,
		doubleQuoteString: {
			action: [ 'style' , stringStyle ] ,
			events: [
				{
					match: /^\\/ ,
					state: 'escape'
				} ,
				{
					match: /^["\n]/ ,
					state: 'idle' ,
					delay: true
				}
			]
		} ,



		openBrace: {
			subProgram: true ,		// stack a new state
			action: [ 'style' , parseErrorStyle ] ,
			events: [
				{
					match: true ,
					state: 'idle' ,
					propagate: true
				}
			]
		} ,
		closeBrace: {
			action: [ 'style' , braceStyle ] ,
			events: [
				{
					match: true ,
					return: 'openBrace' ,	// return (unstack), expecting returning from the 'openBrace' subProgram
					action: [ 'openingStyle' , braceStyle ] ,
					errorAction: [ 'style' , parseErrorStyle ] ,	// if not returning form 'openBrace', we've got a parseError
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
					match: true ,
					state: 'idle' ,
					propagate: true
				}
			]
		} ,
		closeBracket: {
			action: [ 'style' , braceStyle ] ,
			events: [
				{
					match: true ,
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
					match: true ,
					state: 'idle' ,
					propagate: true
				}
			]
		} ,
		closeParenthesis: {
			action: [ 'style' , braceStyle ] ,
			events: [
				{
					match: true ,
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
					match: ' ' ,
					state: 'afterIdentifier'
				} ,
				{
					match: '.' ,
					state: 'dotAfterIdentifier'
				} ,
				{
					match: '(' ,
					state: 'openParenthesis' ,
					action: [ 'blockStyle' , methodStyle ]
				} ,
				{
					match: true ,
					state: 'idle' ,
					propagate: true
				}
			]
		} ,
		dotAfterIdentifier: {
			action: [ 'style' , idleStyle ] ,
			events: [
				{
					match: ' ' ,
					state: 'dotAfterIdentifier'
				} ,
				{
					match: /^[a-zA-Z_$]/ ,
					state: 'member'
				} ,
				{
					match: true ,
					state: 'idle' ,
					propagate: true
				}
			]
		} ,
		member: {
			action: [ 'style' , propertyStyle ] ,
			events: [
				{
					match: /^[a-zA-Z0-9_$]/ ,
					state: 'member'
				} ,
				{
					match: true ,
					state: 'afterIdentifier' ,
					propagate: true ,
					continue: true		// continue the block
				}
			] ,
			// Checked when an event would change the state
			buffer: [
				{
					match: memberKeywords ,
					// replace the 'action' of the event, also work with any properties of the event except 'match' BTW
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
					match: '/' ,
					state: 'lineComment' ,
					action: [ 'style' , commentStyle ]
				} ,
				{
					match: '*' ,
					state: 'multiLineComment' ,
					action: [ 'style' , commentStyle ]
				} ,
				{
					match: true ,
					state: 'idle'
				}
			]
		} ,
		lineComment: {
			action: [ 'style' , commentStyle ] ,
			events: [
				{
					match: '\n' ,
					state: 'idle'
				}
			]
		} ,
		multiLineComment: {
			action: [ 'style' , commentStyle ] ,
			events: [
				{
					match: '*' ,
					state: 'multiLineCommentAsterisk'
				}
			]
		} ,
		multiLineCommentAsterisk: {
			action: [ 'style' , commentStyle ] ,
			events: [
				{
					match: '/' ,
					state: 'idle' ,
					delay: true
				} ,
				{
					match: true ,
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
					match: true ,
					return: true ,
					state: 'idle' ,		// This is ignored if the current state can return
					delay: true
				}
			]
		}
	}
} ;



module.exports = prog ;


