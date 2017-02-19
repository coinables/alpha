var express = require("express");
var app = express();
var request = require("request");
var bodyparser = require("body-parser");
var bitcore = require("bitcore-lib");

app.use(bodyparser.urlencoded({
    extended: true
}));
app.use(bodyparser.json());

app.set("view engine", "ejs");

app.get("/", function(req, res){
    res.render("pages/index.ejs", {
         outMessage: ""
    });
});

app.post("/address", function(req,res){
	var wif = req.body.pkey;
	var opMsg = req.body.opMsg;
	
		//validate pkey
		pkeyValue = wif.replace(/[^\w\s]/gi, '');
		if(bitcore.PrivateKey.isValid(pkeyValue)){
		//private key is valid
		
		//check opMsg Length
		msgLength = opMsg.length;
		if(msgLength > 80){
		res.render("pages/index.ejs", {
            outMessage: "Message must be less than 80 bytes in length"
        });
		}
		
            //convert pk to address
			var address = new bitcore.PrivateKey(pkeyValue).toAddress();		
			//create a tx
			var privateKey = new bitcore.PrivateKey(pkeyValue);
			
			//get unspent from bcinfo
			var url = "https://blockchain.info/unspent?active="+ address;
			request({
				url: url,
				json: true
			},function(error, response, body){
                if(!body.unspent_outputs){
                    res.render("pages/index.ejs", {
                        outMessage: "No UTXOs For This Address"
                    });
                };
				if(body.unspent_outputs){
					var num = body.unspent_outputs.length;
					var utxos = [];
					var totalSats = 0;	
					var txSize = 44;
						
						for(i=0;i < num; i++){
						var utxo = {
							"txId": body.unspent_outputs[i].tx_hash_big_endian,
							"outputIndex": body.unspent_outputs[i].tx_output_n,
							"address": address,
							"script": body.unspent_outputs[i].script,
							"satoshis": body.unspent_outputs[i].value
						};
						utxos.push(utxo);
						totalSats = totalSats + body.unspent_outputs[i].value;
						txSize = txSize + 180;
						};
						
					var fee = txSize * 20;
					totalSats = totalSats - fee;
					
					if(totalSats < 1){
					    res.render("pages/index.ejs", {
                           outMessage: "This transaction can't afford the 20 satoshis per byte mining fee"
                        });
					} else {
						
					var transaction = new bitcore.Transaction()
					  .from(utxos)
					  .addData(opMsg) // Add OP_RETURN data
					  .sign(pkeyValue);
									
					
					var txjson = transaction.toString();
					var pload = {
						"tx_hex": txjson
					};
					
					request({
						url: "https://chain.so/api/v2/send_tx/BTC/",
						method: "POST",
						json: true,
						headers: {
							"content-type": "application/json",
						},
						body: pload
					}, function(err, response, body){
						if(err || response.statusCode != 200){ 
							console.log(err);
						};
                        
						console.log(JSON.stringify(body));
                        completeTxId = body.data.txid;
                        console.log("done");
                        //display to user
                        res.render("pages/address.ejs", {
                            amountTx: totalSats,
                            embedMsg: opMsg,
                            successTxId: completeTxId
                        });
					});
					
				};
					
					
				}
			});
		
		} else {
		//priv key invalid
		res.render("pages/index.ejs", {
            outMessage: "Invalid Private Key"
        });
            
		}
		
});


app.listen(80, function(){
    console.log("go");
});