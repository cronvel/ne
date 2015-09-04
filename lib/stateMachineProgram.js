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





var idleStyle = { color: 'white' } ;
var keywordStyle = { color: 'brightWhite' , bold: true } ;
var constantKeywordStyle = { color: 'brightBlue' , bold: true } ;
var identifierStyle = { color: 'red' } ;
var numberStyle = { color: 'cyan' } ;
var stringStyle = { color: 'blue' } ;
var escapeStyle = { color: 'brightCyan' , bold: true } ;
var commentStyle = { color: 'brightBlack' } ;

var parseErrorStyle = { color: 'brightWhite' , bgColor: 'red' , bold: true } ;
var braceStyle = { color: 'brightWhite' , bold: true } ;



var keywords = [
	'var' , 'new' ,
	'function' , 'return' ,
	'if' , 'else' ,
	'for' , 'in' , 'while' , 'switch' , 'break' , 'continue'
] ;

var constantKeywords = [
	'true' , 'false' , 'null' , 'undefined' , 'Infinity' , 'NaN'
] ;



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
			event: [
				{
					trigger: /^[a-zA-Z_$]/ ,	// the event should match this to trigger those actions
					state: 'identifier' ,	// next state
					
					propagate: false ,		// eat the event or propagate it immediately to the next state?
					action: null ,			// action at trigger time, run before the action of the next state
					delay: false ,			// for this time, the old state action will be executed rather than the new one
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
					trigger: '(' ,
					state: 'openParenthesis'
				} ,
				{
					trigger: ')' ,
					state: 'closeParenthesis'
				} ,
			]
		} ,
		identifier: {
			action: [ 'style' , identifierStyle ] ,
			event: [
				{
					trigger: /^[a-zA-Z0-9_$]/ ,
					state: 'identifier'
				} ,
				{
					trigger: true ,
					state: 'idle' ,
					propagate: true
				}
			] ,
			buffer: [		// Checked when an event would change the state
				{
					trigger: keywords ,
					// replace the 'action' of the event, also work with any properties of the event except 'trigger' BTW
					action: [ 'bufferStyle' , keywordStyle ]
				} ,
				{
					trigger: constantKeywords ,
					action: [ 'bufferStyle' , constantKeywordStyle ]
				}
			]
		} ,
		number: {
			action: [ 'style' , numberStyle ] ,
			event: [
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
			event: [
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
			event: [
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
			event: [
				{
					trigger: true ,
					state: 'idle' ,
					propagate: true
				}
			]
		} ,
		closeBrace: {
			action: [ 'style' , braceStyle ] ,
			event: [
				{
					trigger: true ,
					return: 'openBrace' ,
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
			event: [
				{
					trigger: true ,
					state: 'idle' ,
					propagate: true
				}
			]
		} ,
		closeParenthesis: {
			action: [ 'style' , braceStyle ] ,
			event: [
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
		
		
		
		idleSlash: {
			action: [ 'style' , idleStyle ] ,
			event: [
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
				} ,
			]
		} ,
		lineComment: {
			action: [ 'style' , commentStyle ] ,
			event: [
				{
					trigger: '\n' ,
					state: 'idle' ,
				}
			]
		} ,
		multiLineComment: {
			action: [ 'style' , commentStyle ] ,
			event: [
				{
					trigger: '*' ,
					state: 'multiLineCommentAsterisk' ,
				}
			]
		} ,
		multiLineCommentAsterisk: {
			action: [ 'style' , commentStyle ] ,
			event: [
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
			event: [
				{
					trigger: true ,
					return: true ,
					state: 'idle' ,		// This is ignored if the current state can return
					delay: true
				} ,
			]
		} ,
	}
} ;



module.exports = prog ; 


