mongo = null;
exports.initialize=function(m){
	mongo = m;
}
function createSalt(){
  var crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
}

function createHash(string){
  var crypto = require('crypto');
  return crypto.createHash('sha256').update(string).digest('hex');
}
function createUser(username, password, password_confirmation, callback){
  var coll = mongo.collection('users');

  if (password !== password_confirmation) {
    var err = 'The passwords do not match';
    callback(err);
  } else {
    var query      = {username:username};
    var salt       = createSalt();
    var hashedPassword = createHash(password + salt);
    var userObject = {
      username: username,
      salt: salt,
      hashedPassword: hashedPassword
    };

    // make sure this username does not exist already
    coll.findOne(query, function(err, user){
      if (user) {
        err = 'The username you entered already exists';
        callback(err);
      } else {
        // create the new user
        coll.insert(userObject, function(err,user){
          callback(err,user);
        });
      }
    });
  }
}

function authenticateUser(username, password, callback){
  var coll = mongo.collection('users');

  coll.findOne({username: username}, function(err, user){
    if (err) {
      return callback(err, null);
    }
    if (!user) {
      return callback(null, null);
    }
    var salt = user.salt;
    var hash = createHash(password + salt);
    if (hash === user.hashedPassword) {
      return callback(null, user);
    } else {
      return callback(null, null);
    }
  });
}
exports.login = function(req,res){
	console.log("login posted");
	if(!req.session.user){

		var username = req.form.fields.username;
		var password = req.form.fields.password;
		authenticateUser(username,password,function(err,user){
			if(user){
				req.session.user = user;
				console.log("just set req.session.user to "+stringify(user));
				res.redirect('/contacts');
			}else{
				console.log("user did not authenticate");
				res.redirect("/");
				req.session.user = null;
			}
		})
	}else{
		res.redirect("/contacts");
	}
}
exports.signup = function(req,res){
	console.log("signup");
	var username = req.form.fields.username;
	var password = req.form.fields.password;
	createUser(username,password,password,function(err,user){
		if(err){
			console.log(err);
		}
		console.log("user: "+user);
		res.redirect("/");
	})
}
exports.list = function(req, res){
  res.send("respond with a resource");
};