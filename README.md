<p>
<img src="https://github.com/homebridge/branding/raw/master/logos/homebridge-wordmark-logo-vertical.png" width="150">
</p>

<span align="center">

# Homebridge Plugin for SML SmartMeter devices. NOT WORKING, YET

</span>

This is a Homebridge plugin to read SML-Interface (Infrared) SmartMeter data. WORK IN PROGRESS


Uses https://github.com/Apollon77/smartmeter-obis to read the Smart Meter data. This will also support D0 protocols, later.


### Setup Development Environment

- Node.js 18 or later installed, and a modern code editor such as [VS Code](https://code.visualstudio.com/). This plugin template uses [TypeScript](https://www.typescriptlang.org/) to make development easier and comes with pre-configured settings for [VS Code](https://code.visualstudio.com/) and ESLint. If you are using VS Code install these extensions:

- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)

### Install Development Dependencies

Using a terminal, navigate to the project folder and run this command to install the development dependencies:

```shell
$ npm install
```


### Build Plugin

TypeScript needs to be compiled into JavaScript before it can run. The following command will compile the contents of your [`src`](./lib) directory and put the resulting code into the `dist` folder.

```shell
$ npm run build
```

### Link To Homebridge

Run this command so your global installation of Homebridge can discover the plugin in your development environment:

```shell
$ npm link
```

You can now start Homebridge, use the `-D` flag, so you can see debug log messages in your plugin:

```shell
$ homebridge -D
```

### Watch For Changes and Build Automatically

If you want to have your code compile automatically as you make changes, and restart Homebridge automatically between changes, you first need to add your plugin as a platform in `~/.homebridge/config.json`:
```
{
...
    "platforms": [
        {
            "name": "Config",
            "port": 8581,
            "platform": "config"
        },
        {
            "name": "homebridge-sml",
            //... any other options, as listed in config.schema.json ...
            "platform": "<PLATFORM_NAME>"
        }
    ]
}
```

and then you can run:

```shell
$ npm run watch
```

This will launch an instance of Homebridge in debug mode which will restart every time you make a change to the source code. It will load the config stored in the default location under `~/.homebridge`. You may need to stop other running instances of Homebridge while using this command to prevent conflicts. You can adjust the Homebridge startup command in the [`nodemon.json`](./nodemon.json) file.

### Customise Plugin

You can now start customizing the plugin template to suit your requirements.

- [`src/SmlPlatform.ts`](lib/platform.ts) - this is where your device setup and discovery should go.
- [`src/platformAccessory.ts`](lib/platformAccessory.ts) - this is where your accessory control logic should go, you can rename or create multiple instances of this file for each accessory type you need to implement as part of your platform plugin. You can refer to the [developer documentation](https://developers.homebridge.io/) to see what characteristics you need to implement for each service type.
- [`config.schema.json`](./config.schema.json) - update the config schema to match the config you expect from the user. See the [Plugin Config Schema Documentation](https://developers.homebridge.io/#/config-schema).

### Versioning Your Plugin

Given a version number `MAJOR`.`MINOR`.`PATCH`, such as `1.4.3`, increment the:

1. **MAJOR** version when you make breaking changes to your plugin,
2. **MINOR** version when you add functionality in a backwards compatible manner, and
3. **PATCH** version when you make backwards compatible bug fixes.

You can use the `npm version` command to help you with this:

```shell
# major update / breaking changes
$ npm version major

# minor update / new features
$ npm version update

# patch / bugfixes
$ npm version patch
```


### Publishing

When you are ready to publish the plugin you should set `private` to false, or remove the attribute entirely.

```shell
$ npm publish
```

If you are publishing a scoped plugin, i.e. `@username/homebridge-xxx` you will need to add `--access=public` to command the first time you publish.

### Publishing Beta Versions

You can publish *beta* versions of your plugin for other users to test before you release it to everyone.

```shell
# create a new pre-release version (eg. 2.1.0-beta.1)
$ npm version prepatch --preid beta

# publish to @beta
$ npm publish --tag=beta
```

Users can then install the  *beta* version by appending `@beta` to the install command, for example:

```shell
$ sudo npm install -g homebridge-sml@beta
```

### Best Practices
Consider creating your plugin with the [Homebridge Verified](https://github.com/homebridge/verified) criteria in mind. This will help you to create a plugin that is easy to use and works well with Homebridge.
You can then submit your plugin to the Homebridge Verified list for review.
The most up-to-date criteria can be found [here](https://github.com/homebridge/verified#requirements).
For reference, the current criteria are:

- The plugin must successfully install.
- The plugin must implement the [Homebridge Plugin Settings GUI](https://github.com/oznu/homebridge-config-ui-x/wiki/Developers:-Plugin-Settings-GUI).
- The plugin must not start unless it is configured.
- The plugin must not execute post-install scripts that modify the users' system in any way.
- The plugin must not contain any analytics or calls that enable you to track the user.
- The plugin must not throw unhandled exceptions, the plugin must catch and log its own errors.
- The plugin must be published to npm and the source code available on GitHub.
  - A GitHub release - with patch notes - should be created for every new version of your plugin.
- The plugin must run on all [supported LTS versions of Node.js](https://github.com/homebridge/homebridge/wiki/How-To-Update-Node.js), at the time of writing this is Node.js v16, v18 and v20.
- The plugin must not require the user to run Homebridge in a TTY or with non-standard startup parameters, even for initial configuration.
- If the plugin needs to write files to disk (cache, keys, etc.), it must store them inside the Homebridge storage directory.

### Useful Links
Note these links are here for help but are not supported/verified by the Homebridge team
- [Custom Characteristics](https://github.com/homebridge/homebridge-plugin-template/issues/20)
