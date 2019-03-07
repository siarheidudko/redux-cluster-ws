/**
 *	Redux-Cluster Test
 *	(c) 2018 by Siarhei Dudko.
 *
 *	standart test (cluster IPC channel)
 *	LICENSE MIT
 */

"use strict"

var ReduxCluster = require('redux-cluster'),
	ReduxClusterWS = require('./client.js'), 
	Cluster = require('cluster'),
	Lodash = require('lodash'),
	Colors = require('colors');
	
function editProcessStorage(state = {versions:[]}, action){ 
	try {
		switch (action.type){
			case 'TASK': 
				var state_new = Lodash.clone(state);
				if(state_new.versions.length > 500){
					state_new.versions.splice(0,100);
				}
				state_new.versions.push(action.payload.version);
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

function editProcessStorage2(state = {versions:[]}, action){
	try {
		switch (action.type){
			case 'UPDATE': 
				var state_new = Lodash.clone(state);
				state_new.versions = action.payload.versions;
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

	
var Test = ReduxClusterWS.createStore(editProcessStorage);
Test.mode = "action";
var Test2 = ReduxCluster.createStore(editProcessStorage2);
Test2.mode = "snapshot";


Test2.backup({count:1, path:"./test2.backup", key:"test"}).finally(function(){
	Test.createWSClient({host: "http://localhost", port: 8888, login:"test", password:'123456'});
	Test.dispatch({type:'TASK', payload: {version:'MasterRemote0'}});
	var i = 0;
	setInterval(function(){
		Test.dispatch({type:'TASK', payload: {version:'MasterRemote'+i}});
		i++;
	}, 1010);
	
	Test2.createServer({host: "0.0.0.0", port: 8889, logins:{test2:'123456'}});
	Test.subscribe(function(){
		Test2.dispatch({type:'UPDATE', payload: {versions:Test.getState().versions}});
	});
});