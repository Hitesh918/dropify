const express = require("express")
const mongoose = require("mongoose")

const app = express()


app.set("view engine", "ejs")
app.use(express.static(__dirname + '/public'))
// app.use(express.json())
app.use(express.urlencoded({extended: false}))

mongoose.connect("mongodb+srv://hrenukunta66:hitesh66@cluster0.pfx1ved.mongodb.net/courierDB")
.catch((err) => {
    console.log(err)
})

const stopSchema=new mongoose.Schema({
    pincode:Number , 
    name:String,
    isJunction:Boolean
})

const Stop=mongoose.model("stops" , stopSchema)

const routeSchema=new mongoose.Schema({
    id:Number,
    routeName:String ,
    stops:[{
    pincode : Number , 
    idealTime:String,
    timeFromPrev:Number,
    }],
    returnAfter:Number
})

const Route=mongoose.model("routes" , routeSchema)

const counterSchema=new mongoose.Schema({
    orderCount:Number ,
    routeCount:Number , 
    stopCount:Number
})

const Counter=new mongoose.model("counters" , counterSchema)


app.get("/" , (req,res)=>{
    res.render("index")
})
app.get("/track", (req,res)=>{
    res.render("track")
})
app.get("/admin", (req,res)=>{
    res.render("admin")
})
app.get("/newStop", (req,res)=>{
    res.render("newStop")
})

// app.get("/newCourier" , (req,res)=>{

//     Place.find().then(arr=>{
//         res.render("newCourier" , {
//             sources:arr
//         })

//     })
//     .catch(err=>{
//         // console.log(err)
//     })


// })

app.get("/allRoutes" ,async (req,res)=>{
    let arr=await Route.aggregate([{
        $project: {
          routeName:1,
          firstElement: { $arrayElemAt: ["$stops", 0] },
          lastElement: { $arrayElemAt: ["$stops", -1] }
        }
      } ,
        {
            $addFields:{
                source:"$firstElement.pincode",
                destination:"$lastElement.pincode"
            }
        } ,
    {
        $project:{
            firstElement:0 ,
            lastElement:0 ,
            _id:0
        }
    } ,
    {
        $lookup : {
            from:"stops" , 
            localField:"source",
            foreignField:"pincode",
            as:"src"
        }
      
    } , 
    {
        $lookup : {
            from:"stops" , 
            localField:"destination",
            foreignField:"pincode",
            as:"dest"
        }
    } , {
        $unwind:"$src"
    } , 
    {
        $unwind : "$dest"
    } ,
    {
        $project:{
            routeName:1,
            src : "$src.name",
            dest : "$dest.name"
        }
    
    }
    ])
    res.render("allRoutes" , {
        arr:arr
    })
})

app.get("/viewRoute/:routeName" ,async (req,res)=>{
    let routeName=req.params.routeName
    let arr= await Route.aggregate([{$match : {routeName : routeName}} , {$unwind : "$stops"} , {$replaceRoot: { newRoot: "$stops" }} , {$lookup : {from : "stops" , localField : "pincode" , foreignField : "pincode" , as : "placeName" }} , {$unwind : "$placeName"} , {$addFields : {"name":"$placeName.name"}} , {$project: {placeName : 0 , _id:0}}]) 
    let arr2=await Stop.find()
    res.render("viewRoute" , {
        stops:arr,
        places:arr2
    })
})

// app.post("/newCourier" , (req,res)=>{
//     console.log(req.body)

    
//     res.redirect("/admin")
// })

app.get('/newRoute' , (req,res)=>{
    Stop.find().then((arr)=>{
        res.render("newRoute" , {
            places:arr
        }) 
    })
    .catch(err=>{
        console.log(err)
    })
})

app.post("/newStop" ,async (req,res)=>{
    console.log(req.body)
    let arr=await Stop.find({pincode : req.body.pincode})
    let arr2=await Stop.find({name : req.body.name})
    if(arr.length!=0 || arr2.length!=0){
        res.send(`<script> alert("stop with same name or pincode already exists") </script>`)
    }
    else{
        let x=new Stop({
            pincode:req.body.pincode,
            name:req.body.name,
            isJunction:false
        })
        x.save()
        await Counter.updateOne({} , {$inc:{stopCount:1}})
        res.redirect("/admin")
    }

})


app.post('/newRoute' ,async (req,res)=>{
    console.log(req.body)
    if( req.body.start=="Select" || req.body.end=="Select" || !req.body.time || !req.body.routeName){
        res.send(`<script> alert("missing details") </script>`)
    }
    else if(req.body.start==req.body.end){
        res.send(`<script> alert("starting and ending point cannot be same") </script>`)
    }
    else{ 
        JLhrs=parseInt(req.body.JLhrs)
        JLmin=parseInt(req.body.JLmin)
        RAdays=parseInt(req.body.RAdays)
        RAhrs=parseInt(req.body.RAhrs)

        JLTmin=JLhrs*60 + JLmin
        RAThrs=RAdays*24 + RAhrs
        if(JLTmin <= 0 ){
            res.send(`<script> alert("invalid journey length") </script>`)
        }

        function addMinutes(time, minsToAdd) {
            function D(J){ return (J<10? '0':'') + J;};
            var piece = time.split(':');
            var mins = piece[0]*60 + +piece[1] + +minsToAdd;
          
            return D(mins%(24*60)/60 | 0) + ':' + D(mins%60);  
        } 
        let starting =await Stop.findOne({name:req.body.start})
        let ending =await Stop.findOne({name:req.body.end})
        let count=await Counter.findOne({})

        let x=new Route({
            id:count.routeCount+1,
            routeName:req.body.routeName.replace(" " , "-"),
            stops:[{
                pincode:starting.pincode,
                idealTime:req.body.time,
                timeFromPrev:null
            },{
                pincode:ending.pincode,
                idealTime:addMinutes(req.body.time , JLTmin) , 
                timeFromPrev:JLTmin
            }],
            returnAfter:RAThrs
        })
        x.save()
        await Counter.updateOne({} , {$inc:{routeCount:1}})
        res.redirect("/admin")   
    }
})


app.post("/addStop" , (req,res)=>{
    let Tmin=req.body.hrs*60 + req.body.min
    if(Tmin==0 || req.body.stop=="Select"){
        res.send(`<script> alert("missing details") </script>`)
    }
    console.log(req.body)
})

app.listen(3000);