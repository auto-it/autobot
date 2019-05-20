/* eslint-disable */

const { toLambda } = require("probot-serverless-now");
const autobot = require("./lib/app");

module.exports = toLambda(autobot);
