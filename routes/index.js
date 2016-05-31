var httprequest = require('request')
var ObjectID = require('mongodb').ObjectID

exports.index = function(req, res){
  res.render('index', { title: 'Express' });
};
exports.contacts = function(req,res){
    res.render("contacts",{ title:"Contacts"});
}
exports.contactform = function(req,res){
	var obj ={title:"Contact",contact:{}};
	obj.contact_form={
				"fullname":{label:"Full Name"}
				,"lastname":{label:"Last"}
				,"firstname":{label:"First"}
				,"home":{label:"Home Phone"}
				,"mobile":{label:"Mobile Phone"}
				,"e-mail":{label:"E-Mail"}
				,"zip":{label:"Postal Code"}
				,"country":{label:"Country",default:"US"}
				,"address":{label:"Address"}
				,"address2":{label:"Address"}
				,"city":{label:"City"}
				,"state":{label:"State"}
			}

	var id = req.form.id;
	if(id){
	    id=new ObjectID(id);
		mongodb.collection("contact",function(err,col){
				if(err==null){
					col.findOne({"_id":id},function(err,doc){
						obj.contact=doc;
						res.render("contactform",obj);
					})
				}else{
					res.end(err);
				}
		});

	}else{
		res.render("contactform",obj);
	}
}

exports.zipdata = function(req,res){
	var country = req.form.country?req.form.country:"us";
	var zip = req.form.zip;
	var result = {};

	console.log("zip: "+zip);
	if(zip){
		var url = "http://api.zippopotam.us/"+country+"/"+zip;
		var ziphost = "api.zippopotam.us"
		console.log("url: "+url);
		httprequest(url, function(error, response, body){
		  if (!error && response.statusCode === 200) {
		    const zipResponse = JSON.parse(body)
		    result.city = zipResponse.places[0]["place name"];
			result.state = zipResponse.places[0]["state"];
			result.stateabbr = zipResponse.places[0]["state abbreviation"];
			result.country = zipResponse.country;
			result.countryabbr = zipResponse["country abbreviation"];
			console.dir(result);
		    res.send(result);
		  } else {
		    console.log("Got an error: ", error, ", status code: ", response.statusCode)
		    res.end(error);
		  }
		})
	}
}

