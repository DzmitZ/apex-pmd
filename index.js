const ApexPMD = require('./ApexPMD');

const express = require('express');
const bodyParser = require("body-parser");
const app = express();
const port = process.env.PORT || 5000;

app.use(bodyParser.json({limit: '50mb'}));
app.listen(port, () => console.log(`Port: ${port}`));
app.post('/apexPMD',authCheck, (req, res) => {
  try {
    let data = req.body;
    const getAuthDetails = async _ => {
      console.log('get access token:');
      const token = process.env.sf_token.split(' ');
      const response  = await axios.post(data.backUrl+'/services/oauth2/token', null, {
        params: {
            grant_type: 'refresh_token',
            refresh_token: token[0],
            client_id: token[1],
            client_secret: token[2],
        },
      });
      console.log(response.status);
      console.log(response.statusText);
      if (response.data?.access_token!=null){
        console.log('send request');
        const request = axios.create();
        request.interceptors.request.use((config) => {
          config.headers.accept = 'application/json';
          config.headers.authorization = 'Bearer '+response.data.access_token;
          config.baseURL = response.data.instance_url;
          config.maxBodyLength = 104857600;
          config.maxContentLength = 104857600;
          return config;
        });
        const result = await request.post('/services/apexrest/Flosum/async', {
            attachment: JSON.stringify(data.attList),
            opType: 'ATTACHMENT',
        });
        console.log(result.status);
        console.log(result.statusText);
      } else {
        console.log('access token null');
      }
    }
      getAuthDetails();
    let init = new ApexPMD(data.backUrl, data.sId, data.jobId, data.attList, data.attRuls, data.branchId);

    const control = async _ => {
      console.log('Start')
      while (init.isContinue) {
        const getAtt = await init.getAttachment();
        console.log(getAtt);
        const getRul = await init.getRuls();
        console.log(getRul);
        const run = await init.runPMD();
        console.log(run);
        const save = await init.saveResults();
        console.log(save);
        const updt = await init.updateObjects();
        console.log(updt);
        const clean = await init.cleanFolder();
        console.log(clean);
      }
    };
    control();
    res.send({isSuccess: true, opStatus: 'INPROGRESS'});
  } catch (error) {
    console.log(error);
  }
});

app.get('/oauth/token', authCheck, (req, res) => {
  let auth;
  if (req.header('x-auth-method') === 'Basic') {
    auth = {
      access_token: 'a54c0200-5f3b-4625-b231111112131213',
      token_type: 'bearer',
      refresh_token: '475b9443-9cef-4468-a4be-e3f449da8d03',
      expires_in: 1867,
      scope: 'read write trust'
    };
  } else if (req.header('x-auth-method') === 'AccessToken') {
    auth = {
      access_token: req.headers.authorization,
      token_type: 'bearer',
      expires_in: 300,
    };
  }
  res.send(auth);
});

app.get('/', (req, res) => {
  res.send('Ok. Ver:3.0.0-test1. Ver.PMD: 7.0.0');
});

function authCheck (req, res, next) {
  if (req.headers.authorization) { 
    if (req.header('x-auth-method') === 'Basic' && req.headers.authorization.search('Basic ') === 0) {
      // fetch login and password
      let userEnv = process.env.username;
      let passEnv = process.env.password;
      if (new Buffer.from(req.headers.authorization.split(' ')[1], 'base64').toString() == userEnv + ':' + passEnv) {
        next();
        return;
      }
    } else if (req.header('x-auth-method') === 'AccessToken') {
      next();
      return;
    }
  }
  res.statusCode = 401;
  res.send('not authorization');
}
