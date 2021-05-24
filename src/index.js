import miniCss from "mini.css/dist/mini-default.css"
import mainCss from "./styles/main.css";

import {hello} from './greet'
import {aws_config} from './aws_export'

import {
	CognitoUserPool,
	CognitoUserAttribute,
	CognitoUser,
    AuthenticationDetails
} from 'amazon-cognito-identity-js';

import S3 from 'aws-sdk/clients/s3';
import AWS from 'aws-sdk';
import {CognitoIdentityCredentials} from 'aws-sdk';
import { uuid } from 'uuidv4';

AWS.config.region = aws_config.region;

const userPool = new CognitoUserPool({
    UserPoolId: aws_config.userPoolId,
    ClientId: aws_config.clientId,
});

// AUTH ###############

const register = (registerRequest) => {
    return new Promise((resolve, reject) => {
        const attributeList = [
            new CognitoUserAttribute({
                Name: 'website',
                Value: registerRequest.website,
            })
        ]
    
        userPool.signUp(registerRequest.email, registerRequest.password, attributeList, null, (err, result) => {
            if (err) {
                reject(err);
            }
            resolve(result);
        })
    })
}

const confirmAccount = (confirmAccountRequest) => {
    return new Promise((resolve, reject) => {
        const user = new CognitoUser({
            Username: confirmAccountRequest.email,
            Pool: userPool
        });

        user.confirmRegistration(confirmAccountRequest.code, true, (err, result) => {
            if (err) {
                reject(err);
            }
            resolve(result);
        })
    })
};

const login = (loginRequest) => {
    return new Promise((resolve, reject) => {
        const authDetails = new AuthenticationDetails({
            Username: loginRequest.email,
            Password: loginRequest.password
        });

        const user = new CognitoUser({
            Username: loginRequest.email,
            Pool: userPool
        });

        user.authenticateUser(authDetails, {
            onSuccess: (result) => {
                resolve(result)
            },
            onFailure: (err) => {
                reject(err);
            }
        })
    })
};

const loadSavedCredentials = () => {
    return new Promise((resolve, reject) => {
        const user = userPool.getCurrentUser();

        if (user == null) {
            reject("User not available");
        }

        user.getSession((err, session) => {
            if (err) {
                reject(err);
            }
            
            resolve(session);
        })
    })
}

const getAccessToken = () => {
    return new Promise((resolve, reject) => {
        const user = userPool.getCurrentUser();

        if (user == null) {
            reject("User not available");
        } 

        user.getSession((err, session) => {
            if (err) {
                reject(err);
            }

            resolve(session.getIdToken().getJwtToken());
        })
    })
}

const getCurrentUser = () => {
    return new Promise((resolve, reject) => {
        const user = userPool.getCurrentUser();

        if (user == null) {
            reject("User not available");
        } 

        user.getSession((err, session) => {
            if (err) {
                reject(err);
            }

            user.getUserAttributes((err, attributes) => {
                if (err) {
                    reject(err);
                }

                const profile = attributes.reduce((profile, item) => {
                    return {...profile, [item.Name]: item.Value}
                }, {});

                resolve(profile)
            })
        })
    })
}

const refreshAwsCredentials = (tokenData) => {
    AWS.config.credentials = new CognitoIdentityCredentials({
        IdentityPoolId: aws_config.identityPoolId,
        Logins: {
            'cognito-idp.eu-central-1.amazonaws.com/eu-central-1_vJ7tUmKmn': tokenData.getIdToken().getJwtToken()
        }
    });
}

// File storage ##############

const listFiles = () => {
    const s3 = new S3();

    return new Promise((resolve, reject) => {
        s3.listObjectsV2({
            Bucket: aws_config.bucketName,
            MaxKeys: 10
        }, (err, data) => {
            if (err) {
                reject(err);
            }

            resolve(data.Contents.map(item => {
                return {
                    name: item.Key,
                    size: item.Size
                }
            }));
        })
    });
}

const uploadToS3 = (userId, file, onProgress) => {
    return new Promise((resolve, reject) => {
        const destKey = `uek-krakow/${userId}/images/${uuid()}/${file.name}`;
        const params = {
            Body: file,
            Bucket: aws_config.bucketName,
            Key: destKey
        }

        const s3 = new S3();

        s3.putObject(params, (err, data) => {
            if (err) {
                reject(err);
            }
            resolve(destKey);
        }).on('httpUploadProgress', (progress) => {
            const currentProgress = Math.round((progress.loaded / progress.total) * 100);
            onProgress(currentProgress);
            console.log(`Current pogress is: ${currentProgress}%`);
        })
    });
}

const getPresignedUrl = (key) => {
    const params = {
        Bucket: aws_config.bucketName,
        Key: key
    }

    const s3 = new S3();

    return s3.getSignedUrl('getObject', params);
}

// Animation Order

const order = [];
const addToOrder = (key) => {
    order.push(key);
    return key;
}

const orderAnimation = (token, orderRequest) => {
    return fetch(`${aws_config.apiBaseUrl}/orders`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token,
        },
        body: JSON.stringify(orderRequest)
    })
}

// Html operations ###############

const createElementFromString = (template) => {
    const parent = document.createElement('div');
    parent.innerHTML = template.trim();
    return parent.firstChild;
}

const addToUploadedPreview = (url) => {
    const itemTemplate = 
        `<li>
            <img src="${url}" width="200"/>
        </li>`;
    const el = createElementFromString(itemTemplate);
    const uploadedList = document.querySelector('.uploadedPreview');
    uploadedList.appendChild(el);
}

const clearUploadArea = (filesInput, progressBarEl) => {
    progressBarEl.style.width = `0%`;
    progressBarEl.textContent = `0%`;
    filesInput.Value = '';
}

const registerBtn = document.querySelector('button.register');
const registerRequestPayload = {
    email: "tafslbigeuvaimviet@niwghx.com",
    password: "1234qwer",
    website: "jkan.pl"
}
registerBtn.addEventListener('click', () => {
    register(registerRequestPayload)
        .then(result => console.log(result))
        .catch(err => console.log(err));
});

const confirmAccountBtn = document.querySelector('button.confirmAccount');
const confirmAccountRequestPayload = {
    code: "926763",
    email: registerRequestPayload.email
};
confirmAccountBtn.addEventListener('click', () => {
    confirmAccount(confirmAccountRequestPayload)
        .then(result => console.log(result))
        .catch(err => console.log(err));
});

const loginBtn = document.querySelector('button.login');
const loginRequestPayload = {
    email: registerRequestPayload.email,
    password: registerRequestPayload.password
};
loginBtn.addEventListener('click', () => {
    login(loginRequestPayload)
        .then(data => refreshAwsCredentials(data))
        .then(result => console.log(result))
        .catch(err => console.log(err));
});

const listFilesBtn = document.querySelector('button.listFiles');
listFilesBtn.addEventListener('click', () => {
    listFiles().then(myFiles => console.log(myFiles));
});

const uploadFileBtn = document.querySelector('div.upload .upload__btn');
uploadFileBtn.addEventListener('click', () => {
    const filesInput = document.querySelector('div.upload .upload__input');
    if (!filesInput.files.length > 0) {
        console.log('No files choosen')
        return;
    }

    const progressBarEl = document.querySelector('.upload__progress');

    const toBeUploadedFiles = [...filesInput.files];
    const userId = AWS.config.credentials.identityId;

    toBeUploadedFiles.forEach((file, i) => {
        uploadToS3(userId, file, (currentProgress) => {
            progressBarEl.style.width = `${currentProgress}%`;
            progressBarEl.textContent = `uploading ... ${currentProgress}%`;
        })
            .then(res => addToOrder(res))
            .then(res => getPresignedUrl(res))
            .then(url => addToUploadedPreview(url))
            .finally(() => clearUploadArea(filesInput, progressBarEl))
            .catch(err => console.log(err));
    });
});

const orderAnimationBtn = document.querySelector('button.orderAnimation');
orderAnimationBtn.addEventListener('click', () => {
    const orderRequest = {
        email: registerRequestPayload.email,
        photos: [...order]
    }
    getAccessToken()
        .then(token => orderAnimation(token, orderRequest))
        .then(resp => console.log(resp.json()))
        .catch(err => console.log(err));
});

const cancelOrderAnimationBtn = document.querySelector('button.cancelOrder');
cancelOrderAnimationBtn.addEventListener('click', () => {
    order = [];
});

(() => {
    loadSavedCredentials()
        .then(session => refreshAwsCredentials(session))
        .catch(err => console.log('Cant reload credentials'));

    getCurrentUser()
        .then(profile => hello(profile.email))
        .catch(err => hello('Guest'));
})();