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
    idealReturnTime : String,
    timeFromPrev:Number,
    }],
    returnAfter:Number,
    onEvery:Number
})

const Route=mongoose.model("routes" , routeSchema)

const counterSchema=new mongoose.Schema({
    orderCount:Number ,
    routeCount:Number , 
    stopCount:Number
})

const Counter=new mongoose.model("counters" , counterSchema)

const linkSchema = new mongoose.Schema({
    id:Number ,
    links:[{
        outId:Number , 
        pincode:Number
    }]
})

const Link =new mongoose.model("links" , linkSchema)

function addMinutes(time, minsToAdd) {
    function D(J){ return (J<10? '0':'') + J;};
    var piece = time.split(':');
    var mins = piece[0]*60 + +piece[1] + +minsToAdd;
    return D(mins%(24*60)/60 | 0) + ':' + D(mins%60);  
} 

async function junctionFinder(stopCode , lhs){
    let flag=true
    await Route.find({}).then(async (arr)=>{
        arr.forEach(async (route) =>{
            route.stops.forEach(async (stop)=>{
                if(stop.pincode == stopCode){
                    if(flag){
                        await Stop.findOneAndUpdate({pincode : stopCode} , {isJunction  : true})
                        flag=false
                    }
                    await Link.findOneAndUpdate({id:lhs} , {
                        $addToSet:{links: {
                            outId:route.id , 
                            pincode : stop.pincode
                        }}
                    })
                    await Link.findOneAndUpdate({id:route.id} , {
                        $addToSet:{links: {
                            outId:lhs , 
                            pincode:stop.pincode
                        }} 
                    })
                }
            })
        })
    })
}

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
        places:arr2,
        routeName:routeName
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
    if( req.body.start=="Select" || req.body.end=="Select" || !req.body.time || !req.body.routeName || req.body.onEvery=="Select"){
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

        let routeNames=await Route.find({routeName:req.body.routeName.replace(" " , "-")})
        console.log(routeNames.length)
        if(routeNames.length != 0){
            res.send(`<script> alert("route with given name already exists") </script>`)
        }
        else{
            let starting =await Stop.findOne({name:req.body.start})
            let ending =await Stop.findOne({name:req.body.end})
            let count=await Counter.findOne({})
    
    
            let j=new Link({
                id:count.routeCount+1,
                links:[]
            })
            await j.save()
    
            await junctionFinder(starting.pincode ,count.routeCount+1 )
            await junctionFinder(ending.pincode , count.routeCount+1)
    
    
            let x=new Route({
                id:count.routeCount+1,
                routeName:req.body.routeName.replace(" " , "-"),
                stops:[{
                    pincode:starting.pincode,
                    idealTime:req.body.time,
                    idealReturnTime:addMinutes(req.body.time , (2*JLTmin)+(RAThrs*60)) , 
                    timeFromPrev:null
                },{
                    pincode:ending.pincode,
                    idealTime:addMinutes(req.body.time , JLTmin) ,
                    idealReturnTime:addMinutes(req.body.time , JLTmin+(RAThrs*60)) , 
                    timeFromPrev:JLTmin
                }],
                returnAfter:RAThrs,
                onEvery:parseInt(req.body.onEvery)
            })
            await x.save()
            await Counter.updateOne({} , {$inc:{routeCount:1}})
    
            res.redirect("/admin")   
        }

        
    }
})


app.post("/addStop" ,async (req,res)=>{
    let Tmin=(parseInt(req.body.hrs))*60 + parseInt(req.body.min)
    if(Tmin==0 || req.body.stop=="Select"){
        res.send(`<script> alert("missing details") </script>`)
    }
    let result = await Route.aggregate([{$match : {routeName : req.body.routeName}} , {$unwind : "$stops"} , 
        {$replaceRoot: { newRoot: "$stops" }} , 
        {$lookup : {from : "stops" , localField : "pincode" , foreignField : "pincode" , as : "placeName" }} , 
        {$unwind : "$placeName"} ,
        {$match:{"placeName.name" : req.body.stop}}
    ])
    let timeObj =await  Route.findOne({routeName : req.body.routeName})
    if(result.length != 0 ){
        res.send(`<script> alert("selected stop already exists in the route") </script>`)
    }
    else{

        // let incTime=addMinutes(timeObj.stops[parseInt(req.body.index)].idealTime , Tmin)
        // if(incTime >timeObj.stops[parseInt(req.body.index) +1].idealTime ){
        //     res.send(`<script> alert("invalid timings") </script>`)
        // }
        let incTime=timeObj.stops[parseInt(req.body.index)+1].timeFromPrev
        if(Tmin >= incTime){
            
            res.send(`<script> alert("invalid timings") </script>`)
        }
        else{
            let nameObj=await Stop.findOne({name : req.body.stop})

            await junctionFinder(nameObj.pincode , timeObj.id)

            let nextTime=timeObj.stops[parseInt(req.body.index)+1].idealReturnTime

            await Route.updateOne({routeName : req.body.routeName } , {
                $push:{
                    stops:{
                        $each : [{
                            pincode:nameObj.pincode,
                            idealTime: addMinutes(req.body.prevTime , Tmin), 
                            idealReturnTime:addMinutes(nextTime , (incTime)-(Tmin)) , 
                            timeFromPrev: Tmin
                        }] , 
                        $position : parseInt(req.body.index) +1
                    }
                }
            })
            await Route.updateOne({routeName : req.body.routeName } ,{
                $inc: {
                    [`stops.${parseInt(req.body.index) + 2}.timeFromPrev`]: -1 * Tmin,
                }
            })
    
            res.redirect(`/viewRoute/${req.body.routeName}`)
        }

    }
})

app.listen(3000);