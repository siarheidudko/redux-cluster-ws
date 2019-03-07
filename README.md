
# Redux-Cluster-Ws   
Web-socket wrapper to Redux-Cluster library. 


[![npm](https://img.shields.io/npm/v/redux-cluster-ws.svg)](https://www.npmjs.com/package/redux-cluster-ws)
[![npm](https://img.shields.io/npm/dy/redux-cluster-ws.svg)](https://www.npmjs.com/package/redux-cluster-ws)
[![NpmLicense](https://img.shields.io/npm/l/redux-cluster-ws.svg)](https://www.npmjs.com/package/redux-cluster-ws)
![GitHub last commit](https://img.shields.io/github/last-commit/siarheidudko/redux-cluster-ws.svg)
![GitHub release](https://img.shields.io/github/release/siarheidudko/redux-cluster-ws.svg)

## Install  
[Please see api for Redux-Cluster](https://github.com/siarheidudko/redux-cluster)

```
	npm i redux-cluster redux-cluster-ws --save
```

## Add websocket server wrapper and use  
  
```
require('redux-cluster-ws').server(Test);
Test.createWSServer(<Options>);
```
  
### Example  
  
```
require('redux-cluster-ws').server(Test);
Test.createWSServer({
	host: "0.0.0.0", 
	port: 8888, 
	logins:{
		test2:'123456'
	}, 
	ssl:{
		key: /path/to/certificate-key,
		crt: /path/to/certificate,
		ca:	/path/to/certificate-ca
	}
});

require('redux-cluster-ws').server(Test2);
Test2.createWSServer({
	host: "localhost", 
	port: 8889, 
	logins:{
		test2:'123456'
	}
});
```
   
Options <Object> Required:  
  
- host <String> - hostname or ip-address
- port <Integer> - port (optional, default 10002) 
- logins <Object> - login - password pairs as `{login1:password1, login2:password2}`. 
- ssl <Object> - path to server certificate (if use as https, default use http). 
  
## Add websocket client library  
Client does not use internal Node libraries for webpack compatibility. Therefore, on the client, you must create a store with the same reducer.  

```
//create Redux Store
var ReduxClusterWS = require('redux-cluster-ws').client;
var Test = ReduxClusterWS.createStore(<Reducer>);

//connect to Redux-Cluster server (use socket.io)
Test.createWSClient(<Options>);
```
  
### Example  
  
```
var Test = ReduxCluster.createStore(reducer);
Test.createWSClient({host: "https://localhost", port: 8888, login:"test2", password:'123456'});
```
  
Options <Object> Required:  
  
- host <String> - hostname or ip-address (protocol include)  
- port <Integer> - port (optional, default 10002)  
- login <String> - login in websocket  
- password <String> - password in websocket  
  
  
## LICENSE  
  
MIT  
