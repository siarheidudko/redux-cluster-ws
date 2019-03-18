/**
 *	Redux-Cluster Test
 *	(c) 2018 by Siarhei Dudko.
 *
 *	standart test, include test Socket IPC and TCP (remote) server 
 *	LICENSE MIT
 */

"use strict"

var ReduxCluster = require('redux-cluster'),
	Cluster = require('cluster'),
	Lodash = require('lodash'),
	Http = require('http');
	
	
var Test = ReduxCluster.createStore(editProcessStorage);
require('./index.js').server(Test);

if(Cluster.isMaster){
	let _server = new Http.createServer(undefined).setTimeout(30000).listen(8888, "0.0.0.0"); 
	Test.createWSServer({server: _server, logins:{test2:'123456'}});
}	
function editProcessStorage(state = {version:''}, action){ 
	try {
		switch (action.type){
			case 'TASK':
				var state_new = Lodash.clone(state);
				state_new.version = action.payload.version;
				return state_new;
				break;
			default:
				break;
		}
	} catch(e){
	}
	var state_new = Lodash.clone(state);
	return state_new;
}

Test.subscribe(function(){
	if(Cluster.isMaster){
		var name = 'm';
	} else {
		var name = Cluster.worker.id;
	}
	console.log(' S1 | ' + name + ' | ' + JSON.stringify(Test.getState()));
});

if(Cluster.isMaster){
	for(var i=0; i < 2; i++){
		//setTimeout(function(){Cluster.fork();}, i*10000);
	}
	Test.dispatch({type:'TASK', payload: {version:'OneMasterTest0'}});
	var i = 0;
	setInterval(function(){
		Test.dispatch({type:'TASK', payload: {version:'OneMasterTest'+i}});
		i++;
	}, 1900);
} else {
	var i = 0;
	setInterval(function(){
		Test.dispatch({type:'TASK', payload: {version:'OneWorkerTest'+i}});;
		i++;
	}, 3100+(Cluster.worker.id*3600), i);
}
