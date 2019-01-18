const fs = require('fs-extra');
const csv = require('fast-csv');
const path = require('path');
const sanitize = require('sanitize-filename');

module.exports = {
  defaultConfig: {
    enabled: true,
    guildRoster: true
  },
  defaultConfigDetails: {
    guildRoster: {label: 'Guild Roster'}
  },
  pluginName: 'CSV Exporter',
  pluginDescription: 'Creates local csv files of the selected data',
  temp: {},
  init(proxy, config) {
    proxy.on('apiCommand', (req, resp) => {
      try {
        if (config.Config.Plugins[this.pluginName].enabled) {
          const { command, wizard_id: wizardID } = req;

          if (!this.temp[wizardID]) {
            this.temp[wizardID] = {};
          }

          if (command === 'GetGuildWarBattleLogByWizardId') {
            if (typeof resp.battle_log_list[0] !== 'undefined') {
              this.writeBattleLogToFile(proxy, req, resp, command);
            } else {
              // write empty battle log?
            }
          } else if (command === 'GetGuildWarMatchLog') {
            // write guild battle record
          } else if (command === 'GetGuildWarContributeList') {
            // write guild contribution record
          } else if (command === '***siege commands***') {
            // check out the following siege api commands:
            // GetGuildSiegeRankingInfo
            // GetGuildSiegeMatchupInfo
            // GetGuildSiegeDefenseDeckByWizardId
            // GetGuildSiegeBattleLogByWizardId
            // GetGuildSiegeBaseDefenseUnitList - just for fun to see if we can see stats (doubt it)
          } else if (command === '***labyrinth commands***') {
            // checkout the following labyrinth api commmands:
            // getGuildMazeClearRewardCrateSummary
            // GetGuildMazeMemberInfoList
            // GetGuildMazePlayInfo
            // GetGuildMazeBattleLogByWizard
          }
        }
      } catch (e) {
        proxy.log({type: 'error', source: 'plugin', name: this.pluginName, message: `An unexpected error occured: ${e.message}`});
      }
    });
  },

  getGuildRoster(resp) {
    var rosterObj = resp.guild.guild_members;
    var rosterList = '';

    for (var key in rosterObj) {
      var memberName = rosterObj[key]['wizard_name'];
      var memberId = rosterObj[key]['wizard_id'];
      var grade = rosterObj[key]['grade'];

      rosterList += memberName + ',' + memberId + ',' + grade + '\r\n';
    }

    return rosterList;
  },

  writeRespToFile(proxy, req, resp, command) {
    const filename = sanitize('test ' + command).concat('.json');
    
    let outFile = fs.createWriteStream(path.join(config.Config.App.filesPath, filename), {
      flags: 'w',
      autoClose: true
    });

    outFile.write(JSON.stringify(resp, true, 2));
    outFile.end();
    proxy.log({type: 'success', source: 'plugin', name: this.defaultConfig.pluginName, message: 'Saved test ' + command + ' json'})
  },

  writeBattleLogToFile(proxy, req, resp, command) {
    const wizardName = resp.battle_log_list[0].wizard_name;
    const battleLog = resp.battle_log_list;
    var filename = ''
    if (battleLog[0].log_type == 1) {
      filename = sanitize('gw_attack_logs_' + wizardName).concat('.csv');
    } else {
      filename = sanitize('gw_defense_logs_' + wizardName).concat('.csv');
    }
    
    const numBattles = battleLog.length;
    
    var entry = '';

    var headers = [];
    for (var key in battleLog[0]) {
      headers.push(key);
      entry += key + ',';
    }

    this.saveToFile(battleLog, filename, headers, proxy);
  },

  writeGuildRosterToFile(proxy, req, resp) {
    const wizardName = resp.wizard_info.wizard_name;
    const filename = sanitize('Guild Roster csv').concat('.csv');
    var rosterCsv = this.getGuildRoster(resp);

    let outFile = fs.createWriteStream(path.join(config.Config.App.filesPath, filename), {
      flags: 'w',
      autoClose: true
    });

    outFile.write(rosterCsv);
    outFile.end();
    proxy.log({type: 'success', source: 'plugin', name: this.defaultConfig.pluginName, message: 'Saved guild roster data to '.concat(filename) });

  },

  writeToFile(filename, data, logMessage) {
    let outFile = fs.createWriteStream(path.join(config.Config.App.filesPath, filename), {
      flags: 'w',
      autoClose: true
    });

    outFile.write(data);
    outFile.end();
    proxy.log({type: 'success', source: 'plugin', name: this.defaultConfig.pluginName, message: logMessage });
  },

  // Refactor for this plugin
  saveToFile(entry, filename, headers, proxy) {
    const csvData = [];
    const self = this;
    fs.ensureFile(path.join(config.Config.App.filesPath, filename), err => {
      if (err) {
        return;
      }
      /*
      csv.writeToPath(path.join(config.Config.App.filesPath, filename), entry, { headers }).on('finish', () => {
        proxy.log({type: 'success', source: 'plugin', name: self.pluginName, message: `Saved battle data to ${filename}` });
      });
      */
      
      csv
        .fromPath(path.join(config.Config.App.filesPath, filename), { ignoreEmpty: true, headers, renameHeaders: true })
        .on('data', function(data) {
          csvData.push(data);
        })
        .on('end', () => {
          csvData.concat(entry);
          csv.writeToPath(path.join(config.Config.App.filesPath, filename), entry, { headers }).on('finish', () => {
            proxy.log({ type: 'success', source: 'plugin', name: self.pluginName, message: `Saved run data to ${filename}` });
          });
        });
        
    });
  },

  sortUserData(data) {
    // get storage building id
    let storageID;
    for (let building of data.building_list) {
      if (building.building_master_id === 25) {
        storageID = building.building_id;
      }
    }
    // generic sort function
    cmp = function(x, y) {
      return x > y ? 1 : x < y ? -1 : 0;
    };

    // sort monsters
    data.unit_list = data.unit_list.sort((a, b) =>
      cmp(
        [
          cmp(a.building_id === storageID ? 1 : 0, b.building_id === storageID ? 1 : 0),
          -cmp(a.class, b.class),
          -cmp(a.unit_level, b.unit_level),
          cmp(a.attribute, b.attribute),
          cmp(a.unit_id, b.unit_id)
        ],
        [
          cmp(b.building_id === storageID ? 1 : 0, a.building_id === storageID ? 1 : 0),
          -cmp(b.class, a.class),
          -cmp(b.unit_level, a.unit_level),
          cmp(b.attribute, a.attribute),
          cmp(b.unit_id, a.unit_id)
        ]
      )
    );

    // sort runes on monsters
    for (let monster of data.unit_list) {
      // make sure that runes is actually an array (thanks com2us)
      if (monster.runes === Object(monster.runes)) {
        monster.runes = Object.values(monster.runes);
      }

      monster.runes = monster.runes.sort((a, b) => cmp([cmp(a.slot_no, b.slot_no)], [cmp(b.slot_no, a.slot_no)]));
    }

    // make sure that runes is actually an array (thanks again com2us)
    if (data.runes === Object(data.runes)) {
      data.runes = Object.values(data.runes);
    }

    // sort runes in inventory
    data.runes = data.runes.sort((a, b) =>
      cmp([cmp(a.set_id, b.set_id), cmp(a.slot_no, b.slot_no)], [cmp(b.set_id, a.set_id), cmp(b.slot_no, a.slot_no)])
    );

    // sort crafts
    data.rune_craft_item_list = data.rune_craft_item_list.sort((a, b) =>
      cmp(
        [cmp(a.craft_type, b.craft_type), cmp(a.craft_item_id, b.craft_item_id)],
        [cmp(b.craft_type, a.craft_type), cmp(b.craft_item_id, a.craft_item_id)]
      )
    );

    return data;
  }
}