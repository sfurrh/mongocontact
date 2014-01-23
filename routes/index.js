
exports.index = function(req, res){
  res.render('index', { title: 'Express' });
};
exports.test = function(req,res){
    res.render("contact",{ title:"Contact"});
}
