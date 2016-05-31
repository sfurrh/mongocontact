HOST = "http://localhost";
PORT = 3000;
MONGOHOST = process.env.OPENSHIFT_MONGODB_DB_HOST?process.env.OPENSHIFT_MONGODB_DB_HOST:"localhost";
MONGOPORT = process.env.OPENSHIFT_MONGODB_DB_PORT?process.env.OPENSHIFT_MONGODB_DB_PORT:27017;
MONGOUSER = process.env.OPENSHIFT_MONGODB_DB_USERNAME?process.env.OPENSHIFT_MONGODB_DB_USERNAME:"";
MONGOPASS = process.env.OPENSHIFT_MONGODB_DB_PASSWORD?process.env.OPENSHIFT_MONGODB_DB_PASSWORD:"";
MONGOURL = process.env.OPENSHIFT_MONGODB_DB_URL?process.env.OPENSHIFT_MONGODB_DB_URL:"mongodb://"+MONGOUSER+(MONGOPASS?":"+MONGOPASS:"")+(MONGOUSER?"@":"")+MONGOHOST+":"+MONGOPORT+"/locsystems"

/**
 * Module dependencies.
 */

var express = require('express');
var partials = require('express-partials')
var routes = require('./routes');
var user = require('./routes/user');
var formidable = require('formidable')
var http = require('http');
var path = require('path');
stringify = require('json-stringify-safe');

var moment = require('moment');
var MongoClient = require("mongodb").MongoClient;
var MongoServer = require("mongodb").MongoServer;
var MongoDb = require('mongodb').Db;
var ObjectID = require('mongodb').ObjectID

PDFDocument = require('pdfkit');

var app = express();
app.use(partials());
// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.use(express.favicon());
app.use(express.logger('dev'));
//app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser('furrh-contacts'));
app.use(require("express-session")({
			secret:"furrh-contacts",
			resave:false,
			saveUninitialized:false
		}));
app.use(function(req,res,next){
	/**
	 * this gives me better access to
	 * request parms
	 **/
	 console.log("in param getter: "+req.method);
	if(req.method=="POST"){
		var form = new formidable.IncomingForm();
		form.uploadDir = "./public/files";
		form.keepExtensions = true;
		form.hash = "md5";
		console.log("about to parse form.");
		form.parse(req,function(err,fields,files){
			console.log("huh?");
			req.form={};
			req.form.fields=fields;
			req.form.files=files;
			console.dir(fields)
			console.log("after post parameters passing to next()");
			next();
		});
	}else if(req.method="GET"){
		req.form={fields:{}};

		for(var i in req.query){
			if(req.form.fields[i]){
				if(Array.isArray(req.form[i])){
					req.form.fields[i].push(req.query[i]);
				}else{
					var arr = [req.form.fields[i],req.query[i]];
					req.form.fields[i] = arr;
				}
			}else{
				req.form.fields[i] = req.query[i];
			}
		}
		next()
	}else{
		next();
	}
})
app.use(function(req,res,next){
	var PUBLIC_ROUTES=["^/$","^/login$","^/js/.*","^/css/.*"];
	console.log("middleware engaged: "+req.path);
	var user = req.session.user;
	console.log("session: "+ stringify(req.session));
	if(user){
		console.log("have user: "+stringify(user));
		res.locals({});
		res.locals.user = user;
		if(user.permissions){
			for(var i=0;i<user.permissions.length;i++){
				if(req.path.match(user.permissions[i])){
					console.log("permission: "+req.path+".match("+user.permissions[i]);
					return next();
				}
			}
		}
	}else{
		console.log("no user");
	}
	for(var i=0;i<PUBLIC_ROUTES.length;i++){

		if(req.path.match(PUBLIC_ROUTES[i])){
			console.log("public: "+req.path+".match("+PUBLIC_ROUTES[i]);
			return next();
		}
	}
	console.log("no match: "+req.path);
	/**
	 * if you've gotten to this point you don't have access
	 **/
	 //res.send('<p>some html</p>');
	 console.log("sending 401");
	 res.status(401).send("Sorry, you can't do that that!");
});

var router=app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));
/**
 * SECURITY
 **/



// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/', routes.index);
app.get('/users', user.list);
app.get("/signup",function(req,res){res.render("adduser",{title:"Add User"})});
app.post("/signup",user.signup);
app.get("/contacts",routes.contacts);
app.get("/contactform",routes.contactform);
app.get("/zipdata",routes.zipdata);
app.post("/login",user.login);
app.get("/list/:collection",function(req,res){
    var q=req.param("q");
    if(q){
        q=JSON.parse(q);
    }else{
        q={};
    }
    var o=req.param("o");
    if(o){
        o=JSON.parse(o);
    }else{
        o={};
    }
    var colName = req.params.collection;
    mongodb.collection(colName,function(err,col){
            if(err==null){
                col.find(q).sort(o).toArray(function(err,docs){
                    res.send(docs);
                })
            }else{
                res.end(err);
            }
    });
});
app.get("/delete/:collection/:id",function(req,res){
    var colName = req.params.collection;
    var id = req.params.id;

    if(!colName || !id){
        res.end({"error":"You have to tell me what to delete!"});
    }else{
        var q = {"_id":new ObjectID(id)};
        mongodb.collection(colName,function(err,col){
            if(err==null){
                col.remove(q,function(err,numberOfRemovedDocuments){
                    res.send({"removed":numberOfRemovedDocuments});
                })
            }else{
                res.end(err);
            }
        });
    }
})

app.get("/importcontacts",function(req,res){
    var lazy = require("lazy"),
    fs  = require("fs");
    var obj;
    var colName="contact";
    contactsAdded=0;
    var query={};
    mongodb.collection(colName,function(err,col){
        if(err==null){
            var key;
            var value;
            new lazy(fs.createReadStream('./contacts.txt')).lines.forEach(function(l){
                var line = ""+l;
                line=line.trim().replace(/(\t|\r)+/g,"");
                if(line!=""){
                    if(line.indexOf("Full Name:")==0){
                        if(obj){

                            query={fullname:obj.fullname};
                            col.update(query,obj,{upsert:true,w:1,forceServerObjectId:true},function(err,result){
                                if(err!=null){
                                    console.log("ERROR SAVING OBJECT: "+err);
                                }else{
                                    contactsAdded++
                                    console.log("added one: ");
                                }
                            });
                        }
                        obj={}
                    }
                    var io=line.indexOf(":");
                    if(io>0){
                        key=line.substring(0,io);
                        key=key.toLowerCase();
                        key=key.replace(/( |\t|\r)+/g,"");
                        io++;
                    }else{
                        io=0;
                    }
                    value=line.substring(io);
                    if(obj[key]){
                        if(obj[key] instanceof Array){
                            //ok
                        }else{
                            var curval=obj[key];
                            obj[key]=[curval];
                        }
                        obj[key].push(value);
                    }else{
                        obj[key]=value;
                    }
                }
            });
        }else{
            console.log("error: "+stringify(err));
            res.send("error: "+stringify(err));
        }
    });
    res.end("imported "+contactsAdded);
});
app.get("/printcontacts",function(req,res){
    var q=req.param("q");
    if(q){
        q=JSON.parse(q);
    }
    var colName = req.param("colname");
    mongodb.collection(colName,function(err,col){
            if(err==null){
                col.find(q).toArray(function(err,contacts){
                    doc = new PDFDocument();
                    var col=0;
                    var row=0;
                    for(var i=0;i<contacts.length;i++){
                        var contact = contacts[i];
                       // console.log(stringify(contact));
                        if(contact.fullname){
                            var x = 0 + (col * 208);
                            var y = 0 + (row * 76);
                            if(++col>2){
                                col=0;
                                row++;
                            }
                            if(row>9){
                                doc.addPage("letter");
                                row=0;
                            }

                            console.log("col: "+col+", row: "+row+", x: "+x+", y: "+y);
                            doc.text(contact.fullname,x+10,y+10);
                            doc.rect(x+1, y+1, 208, 76).stroke()
                        }
                    }

                    doc.output(function(string) {
                      res.end(string);
                    });
                })
            }else{
                res.send(stringify(err));
            }
    });
});
app.get("/save",function(req,res){
    var colName = req.param("colname");
    var obj = JSON.parse(req.param("obj"));
    var id=new ObjectID(obj._id);
    obj._id=id;
    obj._modified = moment().utc().format("YYYY-MM-DD HH:mm:ss.SSS");

    var query={_id:id}
    mongodb.collection(colName,function(err,col){
            if(err==null){
                col.update(query,obj,{upsert:true,w:1,forceServerObjectId:true},function(err,result){
                    if(err!=null){
                        console.log(err);
                        res.send("error: "+stringify(err));
                    }else{
                        res.send(obj);
                    }
                });
                console.log("id="+id);
            }else{
                console.log("error: "+stringify(err));
                res.send("error: "+stringify(err));
            }
    });
});


/**
 * run
 **/
mongodb=null;
var mClient = MongoClient.connect("mongodb://"+MONGOHOST+":"+MONGOPORT+"/contacts", function(err, db) {
    if(err==null){
        mongodb=db;
        user.initialize(mongodb);
        http.createServer(app).listen(app.get('port'), function(){

          console.log('Express server listening on port ' + app.get('port'));
        });
    }else{
        console.log(err);
    }
});
