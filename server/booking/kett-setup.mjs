export async function completeKettSetup(body, url, key, send) {
  const response = await fetch(url + '/functions/v1/booking-kett-setup', {
    method:'POST',
    headers:{apikey:key,'Content-Type':'application/json'},
    body:JSON.stringify({token:body.token,username:body.username,password:body.password,confirmation:body.confirmation}),
  });
  return send(response.status, await response.json());
}
