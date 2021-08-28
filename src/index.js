require('dotenv').load()

const knex = require('knex')
const { inspect } = require('util')
const Telegraf = require('telegraf')

const knexConfig = require('../knexfile')

const { session/* , Markup */} = Telegraf
const { BOT_NAME, BOT_TOKEN } = process.env

const debug = (data) => console.log(inspect(data, {
  showHidden: true,
  depth: Infinity,
  colors: true,
}))

const bot = new Telegraf(BOT_TOKEN, {
  telegram: { webhookReply: false },
  username: BOT_NAME,
})

bot.use(session())
bot.context.db = knex(knexConfig)

bot.on('inline_query', async (ctx) => {
  debug(ctx.update)
  if (ctx.inlineQuery.query) {
    if (ctx.inlineQuery.query.includes('_')) {
      const words = await ctx.db('words_ru')
        .select([
          'words_ru.id as id',
          'word',
          ctx.db.raw('COUNT(words_ru.id) as size'),
          ctx.db.raw('MAX(clues_ru.name) as name'),
        ])
        .where(
          'word',
          'like',
          ctx.inlineQuery.query.toUpperCase()
        )
        // .andWhere(
        //   'clues_ru.name',
        //   'not like',
        //   'К сожалению, к этому слово пока не добавлено определений.'
        // )
        .join(
          'clues_ru',
          'words_ru.id',
          '=',
          'clues_ru.word_id'
        )
        .offset(Number(ctx.inlineQuery.offset))
        .limit(50)
        .groupBy('words_ru.id')
        .catch(debug)

      await ctx.answerInlineQuery(words.map((word) => ({
        id: word.id,
        type: 'article',
        title: word.word,
        description: word.name,
        input_message_content: {
          message_text: `${word.word}

Clue: ${word.name}

Query: ${ctx.inlineQuery.query}`,
          // parse_mode: 'Markdown',
        },
        reply_markup: {
          inline_keyboard: [
            [
              // { text: 'Edit', callback_data: `edit/clue/${clue.id}` },
              // { text: 'Remove', callback_data: `remove/clue/${clue.id}` },
              {
                text: `Share Clues for ${word.word.toLowerCase()} (${word.size})`,
                switch_inline_query: word.word,
              },
              {
                text: `Share Words for ${ctx.inlineQuery.query}`,
                switch_inline_query: ctx.inlineQuery.query,
              },
            ],
            [
              // { text: 'Edit', callback_data: `edit/clue/${clue.id}` },
              // { text: 'Remove', callback_data: `remove/clue/${clue.id}` },
              {
                text: `Clues for ${word.word.toLowerCase()} (${word.size})`,
                switch_inline_query_current_chat: word.word,
              },
              {
                text: `Words for ${ctx.inlineQuery.query}`,
                switch_inline_query_current_chat: ctx.inlineQuery.query,
              },
            ],
          ],
        },
      })), {
        is_personal: true,
        cache_time: 0,
        next_offset: Number(ctx.inlineQuery.offset) + 50,
      })
    } else {
      const clues = await ctx.db('words_ru')
        .select(['clues_ru.id as id', 'name', 'word'])
        .where('word', ctx.inlineQuery.query.toUpperCase())
        .innerJoin(
          'clues_ru',
          'words_ru.id',
          '=',
          'clues_ru.word_id'
        )
        .catch(debug)

      // debug(clues)

      // if (clues.length === 0) {

      // }

      await ctx.answerInlineQuery(clues.map((clue) => ({
        id: clue.id,
        type: 'article',
        title: clue.word,
        description: clue.name,
        input_message_content: {
          message_text: `*${clue.word}*

${clue.name}`,
          parse_mode: 'Markdown',
        },
        reply_markup: {
          inline_keyboard: [
            [
              // { text: 'Edit', callback_data: `edit/clue/${clue.id}` },
              // { text: 'Remove', callback_data: `remove/clue/${clue.id}` },
              { text: 'Send', switch_inline_query: clue.word },
              { text: `More... (${clues.length})`, switch_inline_query_current_chat: clue.word },
            ],
          ],
        },
      })), {
        is_personal: true,
        cache_time: 0,
      })
    }
  }
})

bot.startPolling()
