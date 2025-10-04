
const pageNotFound= async(req,res)=>{
    try{
        res.render("user/page-404")

    }catch(error){
        res.status(404).render("user/page-404")
    }

}



const loadlandingHome=async(req,res)=>{
    try{
        return res.render("user/landinghome")

    }catch(error){
        console.log("Home page not found")
        res.status(500).send("server error")
    }

}




module.exports={
    loadlandingHome,
    pageNotFound
}