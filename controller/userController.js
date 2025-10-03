const loadHome=async(req,res)=>{
    try{
        return res.render("user/home")

    }catch(error){
        console.log("Home page not found")
        res.status(500).send("server error")
    }

}




module.exports={
    loadHome
}