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



const os = require( 'os' ) ;
const path = require( 'path' ) ;
const fs = require( 'fs' ) ;
const fsKit = require( 'fs-kit' ) ;

const kungFig = require( 'kung-fig' ) ;

const termkit = require( 'terminal-kit' ) ;
//const term = termkit.terminal ;
const TextEditor = require( './TextEditor.js' ) ;

const Promise = require( 'seventh' ) ;



function Neon( options = {} ) {
	this.metadata = {} ;
	this.metadataTimeout = 1000 * 3600 * 24 * 30 ;	// 30 days of timeout

	this.mainConfig = null ;
	this.fileTypesConfig = null ;

	this.term = options.term || termkit.terminal ;

	this.document = null ;
	this.textEditor = null ;

	this.welcomeAnimation = false ;

	this.appHomeDirectory = path.join( os.homedir() , '.local' , 'share' , 'ne' ) ;
}

module.exports = Neon ;



Neon.prototype.terminate = async function() {
	await this.saveMetadata() ;

	this.term.fullscreen( false ) ;
	this.term.applicationKeypad( false ) ;
	this.term.beep() ;
	this.term.processExit() ;
} ;



Neon.prototype.run = async function() {
	await this.initDir() ;
	await this.loadConfig() ;

	this.term.fullscreen() ;

	this.document = this.term.createDocument( {
		//  backgroundAttr: { bgColor: 'magenta' , dim: true } ,
	} ) ;

	this.textEditor = new TextEditor( {
		parent: this.document ,
		x: 0 ,
		y: 0 ,
		width: this.term.width ,
		height: this.term.height ,
		metadata: this.metadata ,
		fileTypes: this.fileTypesConfig ,
		terminate: () => this.terminate()
	} ) ;

	this.textEditor.lockStatus = true ;

	this.startWelcomeAnimation().then( () => {
		// Allow normal status bar interaction
		this.textEditor.lockStatus = false ;
	} ) ;

	this.textEditor.setContextBar( 'Ctrl-K: Meta   Ctrl-C: quit   Meta-M/top-left button: show/hide the menu' ) ;

	this.document.giveFocusTo( this.textEditor ) ;
} ;



Neon.prototype.initDir = async function() {
	await fsKit.ensurePath( this.appHomeDirectory ) ;
} ;



Neon.prototype.loadConfig = async function() {
	this.loadMetadata() ;

	// Should sanitize it later...
	this.mainConfig = await kungFig.loadAsync( path.join( __dirname , '..' , 'config' , 'main.kfg' ) ) ;
	this.fileTypesConfig = await kungFig.loadAsync( path.join( __dirname , '..' , 'config' , 'files.kfg' ) ) ;
} ;



Neon.prototype.loadMetadata = async function() {
	try {
		this.metadata = JSON.parse( await fs.promises.readFile( path.join( this.appHomeDirectory , 'metadata.json' ) , 'utf8' ) ) ;
	}
	catch {}	// We don't care about error here, no file = no metadata

	if ( ! this.metadata.files ) { this.metadata.files = {} ; }
} ;



Neon.prototype.saveMetadata = async function() {
	// Reload metadata: it can be modified by another instance
	this.loadMetadata() ;
	this.metadataExpiration() ;

	if ( this.textEditor.fileRealPath ) {
		this.metadata.files[ this.textEditor.fileRealPath ] = {
			timestamp: Date.now() ,
			cursors: this.textEditor.exportCursors()
		} ;
	}

	try {
		await fs.promises.writeFile( path.join( this.appHomeDirectory , 'metadata.json' ) , JSON.stringify( this.metadata ) ) ;
	}
	catch ( error ) {
		console.error( "Can't save metadata:" , error ) ;
	}
} ;



Neon.prototype.metadataExpiration = function() {
	// Filter older files, depending on timestamp
	var now = Date.now() ;
	for ( let filePath in this.metadata.files ) {
		if ( this.metadata.files[ filePath ].timestamp + this.metadataTimeout < now ) {
			delete this.metadata.files[ filePath ] ;
		}
	}
} ;



const NEON_ANIMATION = [
	'Neon' ,
	'^bNe^mo^rn' ,
	'^bN^meo^rn' ,
	'^bN^me^ron' ,
	'^BNe^mo^rn' ,
	'^BN^meo^rn' ,
	'^BN^me^ron' ,
	'^bNe^Mo^rn' ,
	'^bN^Meo^rn' ,
	'^bN^Me^ron' ,
	'^bNe^mo^Rn' ,
	'^bN^meo^Rn' ,
	'^bN^me^Ron' ,

	'^+^BN^Me^:^Ron' ,

	'^+^GNe^:^Yon'
] ;

Neon.prototype.doWelcomeAnimationLoop = async function() {
	while ( this.welcomeAnimation ) {
		let anim = NEON_ANIMATION[ Math.floor( Math.random() * NEON_ANIMATION.length ) ] ;
		this.textEditor.setStatusBar( '  ^bWelcome to ' + anim + '^:^b!' ) ;
		await Promise.resolveTimeout( 200 + Math.random() * 500 ) ;
	}
} ;



Neon.prototype.startWelcomeAnimation = function() {
	var promise = new Promise() ;
	this.welcomeAnimation = true ;

	var stop = () => {
		this.welcomeAnimation = false ;
		promise.resolve() ;
	} ;

	this.term.once( 'key' , stop ) ;
	setTimeout( stop , 5000 ) ;

	this.doWelcomeAnimationLoop() ;

	return promise ;
} ;



Neon.prototype.openFile = function( filePath , createIfNotExist = false ) {
	return this.textEditor.openFile( filePath , createIfNotExist ) ;
} ;







// DEPRECATED?

Neon.prototype.onTerminal = function( name , data ) {
	if ( name === 'SCREEN_RESIZE' && this.standAlone ) {
		this.resize( data.width , data.height ) ;
	}
} ;

