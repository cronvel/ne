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
					trigger: /^"/ ,
					state: 'doubleQuoteString'
				} ,
				{
					trigger: /^'/ ,
					state: 'singleQuoteString'
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
			buffer: [
				{
					trigger: keywords ,
					action: [ 'styleBuffer' , keywordStyle ] ,
				} ,
				{
					trigger: constantKeywords ,
					action: [ 'styleBuffer' , constantKeywordStyle ] ,
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
		doubleQuoteString: {
			action: [ 'style' , stringStyle ] ,
			event: [
				{
					trigger: /^["\n]/ ,
					state: 'idle' ,
					delay: true
				} ,
				{
					trigger: true ,
					state: 'doubleQuoteString'
				}
			]
		} ,
		singleQuoteString: {
			action: [ 'style' , stringStyle ] ,
			event: [
				{
					trigger: /^['\n]/ ,
					state: 'idle' ,
					delay: true
				} ,
				{
					trigger: true ,
					state: 'singleQuoteString'
				}
			]
		} ,
	}
} ;



module.exports = prog ; 


