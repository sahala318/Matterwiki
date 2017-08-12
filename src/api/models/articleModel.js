const Model = require("objection").Model;
const { omit, assign } = require("lodash");

const withDBHelpers = require("./withDBHelpers");
const { ARTICLE_HISTORY_TYPES } = require("../utils/constants");

class Article extends Model {
  static get tableName() {
    return "article";
  }

  static get relationMappings() {
    const TopicModel = require("./topicModel").Model;
    const ArticleHistoryModel = require("./articleHistoryModel").Model;
    const UserModel = require("./userModel").Model;

    return {
      topic: {
        relation: Model.BelongsToOneRelation,
        modelClass: TopicModel,
        join: {
          from: "article.topic_id",
          to: "topic.id"
        }
      },
      createdUser: {
        relation: Model.BelongsToOneRelation,
        modelClass: UserModel,
        join: {
          from: "article.created_by_id",
          to: "user.id"
        }
      },
      modifiedUser: {
        relation: Model.BelongsToOneRelation,
        modelClass: UserModel,
        join: {
          from: "article.modified_by_id",
          to: "user.id"
        }
      },
      articleHistory: {
        relation: Model.HasManyRelation,
        modelClass: ArticleHistoryModel,
        join: {
          from: "article.id",
          to: "article_history.article_id"
        }
      }
    };
  }
}

// TODO clean this up a bit
const extraHelpers = {
  /**
   * Sets a simple `WHERE LIKE` query on model
   * Models have to implement their own search methods with the fields that need to be used
   */
  search: searchString => {
    // TODO :(
    const escapedString = `%${searchString}%`;

    return (
      Article.query()
        .where("is_active", true)
        .andWhere("title", "like", escapedString)
        // TODO change when we use MySQL's json type to store editor data
        .orWhere("content", "like", escapedString)
        .orWhere("change_log", "like", escapedString)
    );
  },
  /**
   * Helps insert a history item for a corresponding article
   */
  insertWithHistory: item => {
    const articleHistory = {
      articleHistory: assign({ type: ARTICLE_HISTORY_TYPES.CREATE }, item)
    };
    const graphToInsert = assign({}, item, articleHistory);

    return Article.query().insertGraphAndFetch(graphToInsert);
  },

  /**
   * Helper to delete article and make a new history item
   */
  deleteWithHistory: async id => {
    // delete article
    const article = await Article.query().updateAndFetchById(id, {
      is_active: false
    });

    // placeholder history item
    const articleHistory = {
      type: ARTICLE_HISTORY_TYPES.DELETE
    };

    // make a new history item
    return article.$relatedQuery("articleHistory").insert(articleHistory);
  },

  /**
   * Helper to update article and make a new history item
   */
  updateWithHistory: async (id, item) => {
    // update article
    const article = await Article.query().updateAndFetchById(id, item);

    const articleHistory = assign(
      { type: ARTICLE_HISTORY_TYPES.UPDATE },
      omit(article, "id")
    );

    // make a new history item
    article.articleHistory = await article
      .$relatedQuery("articleHistory")
      .insertAndFetch(articleHistory);

    // return the whole thing out
    return article;
  }
};

module.exports = withDBHelpers(Article, extraHelpers, {
  relations: "[createdUser, topic]"
});
