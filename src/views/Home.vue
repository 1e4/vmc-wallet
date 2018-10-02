<template>
    <div class="home w-100">
        <div class="container">
            <div class="row justify-content-center">
                <div class="col-12 col-md-4" v-if="!isLoggedIn">
                    <div class="card" id="login-form">
                        <div class="card-body">
                            <div class="form-group">
                                <label for="private-key">Enter your public key</label>
                                <input id="private-key" v-model="public_key" class="form-control">
                            </div>
                        </div>
                        <div class="card-footer">
                            <button class="btn btn-purple" @click.prevent="enter">Enter your wallet</button>
                        </div>
                    </div>
                </div>
                <div class="col-12 col-md-4" v-if="isLoggedIn">
                    <div class="card" id="wallet">
                        <div class="card-body">
                            <p>Your balance: {{ this.balance }}</p>

                            <div class="form-group">
                                <label for="transfer-to">Public key to transfer to</label>
                                <input id="transfer-to" v-model="transferForm.to" class="form-control">
                            </div>

                            <div class="form-group">
                                <label for="transfer-amount">Amount</label>
                                <input id="transfer-amount" v-model="transferForm.amount" class="form-control">
                            </div>


                            <div class="form-group">
                                <label for="transfer-pk">Your Private Key</label>
                                <input id="transfer-pk" v-model="transferForm.private_key" class="form-control">
                            </div>

                            <div class="form-group">
                                <button @click.prevent="transfer" class="btn btn-purple">Transfer Tokens</button>
                            </div>
                        </div>
                        <div class="card-footer">
                            <button @click.prevent="logout" class="btn btn-purple">Logout</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style lang="scss">
    @import "../assets/scss/app.scss";
</style>

<script>

    import secp256k1 from 'secp256k1'
    import createHash from 'create-hash'
    import protobuf from '../protobuf'

    export default {
        name: 'home',
        data: function () {
            return {
                public_key: '',
                balance: 0,
                isLoggedIn: false,
                transferForm: {
                    private_key: '',
                    to: '',
                    amount: 0,
                }
            }
        },
        mounted() {
            let pk = localStorage.getItem('_pk');

            if (pk) {
                this.isLoggedIn = true;
                this.public_key = pk;
                this.auth();
            }

            setInterval(this.auth, 1000)
        },
        methods: {
            enter() {
                localStorage.setItem('_pk', this.public_key);
                this.isLoggedIn = true;
                this.auth();
            },
            auth() {
                window.$user.emit("balance", {
                    user: {
                        user: this.public_key
                    }
                }, (res) => {
                    this.balance = res.replace(/['"]+/g, '');
                })
            },
            transfer() {
                let to = this.transferForm.to,
                    amount = this.transferForm.amount,
                    private_key = Buffer.from(this.transferForm.private_key, 'hex'),
                    public_key = this.public_key;

                if (amount > this.balance) {
                    alert('You don\'t have enough tokens');
                    return;
                }

                function _hash(data) {
                    return createHash('sha512').update(data).digest('hex')
                }

                //Globals for create_and_sign
                let dataHash = null
                let result = null
                let signature = null

                function create_and_sign(header) {
                    dataHash = createHash('sha256').update(header).digest()
                    result = secp256k1.sign(dataHash, private_key)
                    signature = result.signature.toString('hex')
                }

                const FAMILY_NAME = 'vmc-core-trans-tp'

                let rawPayload = 'transfer,' + amount.toString() + ',' + to;

                // String to binary
                function str2ab(str) {
                    return new Buffer(str, 'binary'); // 2 bytes for each char
                }

                // Encode payload to binary
                let payload = str2ab(rawPayload);

                // Create address to store in state
                let address = _hash((FAMILY_NAME)).substring(0, 6) + _hash((public_key)).substring(0, 64)

                // List in and output addresses
                let inputAddressList = [address]
                let outputAddressList = [address]

                let toAddress = _hash((FAMILY_NAME)).substring(0, 6) + _hash((to)).substring(0, 64)
                inputAddressList.push(toAddress)
                outputAddressList.push(toAddress)

                // Date object for the nonce
                let d = new Date();

                console.log(protobuf);

                // Create transactionheader
                const transactionHeaderBytes = protobuf.TransactionHeader.encode({
                    signerPublicKey: public_key.toString('hex'),
                    familyName: FAMILY_NAME,
                    familyVersion: '0.1',
                    inputs: inputAddressList,
                    outputs: outputAddressList,
                    dependencies: [],
                    payloadSha512: _hash(payload),
                    batcherPublicKey: public_key.toString('hex'),
                    nonce: d.getTime().toString(16)
                }).finish()

                // Create signature of transactionheader
                create_and_sign(transactionHeaderBytes)

                // Create transaction
                const transaction = protobuf.Transaction.create({
                    header: transactionHeaderBytes,
                    payload: payload,
                    headerSignature: signature
                })

                // List the transaction(s)
                const transactionlist = [transaction]

                // Create and encode BatchHeader
                const batchHeaderBytes = protobuf.BatchHeader.encode({
                    signerPublicKey: public_key.toString('hex'),
                    transactionIds: transactionlist.map((txn) => txn.headerSignature),
                }).finish()

                // Create signature of BatchHeader
                create_and_sign(batchHeaderBytes)

                // Create Batch
                const batch = protobuf.Batch.create({
                    header: batchHeaderBytes,
                    transactions: transactionlist,
                    headerSignature: signature
                })

                let batchListBytes = protobuf.BatchList.encode({
                    batches: [batch]
                }).finish()


                //batchListBytes = new Uint8Array(batchListBytes).buffer;
                batchListBytes = Buffer.from(batchListBytes).toString('base64')

                // Send Batch to validator and await response
                let t = {
                    user: {
                        user: this.public_key
                    },
                    destination: to,
                    batchlist: batchListBytes
                };

                window.$user.emit('transfer-tokens', t, function (res) {
                    console.log('success', res)
                });

                this.auth();
            },
            logout() {
                this.public_key = '';
                this.isLoggedIn = false;
                localStorage.removeItem('_pk');
            }
        },
        components: {}
    }
</script>
