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



var prog = {
	config: {	// Accessible by the host
	} ,
	states: {	// Every states of the machine
		init: {
			action: [ 'style' , { color: 'white' } ] ,	// action when this state is active at the end of the event
			buffer: false ,					// if true, this state start buffering as long as it last
			event: [
				{
					trigger: /[a-zA-Z]/ ,	// the event should match this to trigger those actions
					state: 'identifier' ,	// next state
					propagate: false ,		// eat the event or propagate it immediately to the next state?
					action: null			// action at trigger time, run before the action of the next state
				} ,
				{
					trigger: /[0-9]/ ,
					state: 'number'
				}
			]
		} ,
		identifier: {
			action: [ 'style' , { color: 'brightYellow' } ] ,
			event: [
				{
					trigger: /[a-zA-Z]/ ,
					state: 'identifier'
				} ,
				{
					trigger: true ,
					state: 'init' ,
					propagate: true
				}
			] ,
			buffer: [
				{
					trigger: "this" ,
					action: [ 'styleBuffer' , { color: 'red' , bold: true } ] ,
				}
			]
		} ,
		number: {
			action: [ 'style' , { color: 'blue' } ] ,
			event: [
				{
					trigger: /[0-9.]/ ,
					state: 'number'
				} ,
				{
					trigger: true ,
					state: 'init' ,
					propagate: true
				}
			]
		}
	}
} ;



module.exports = prog ; 


