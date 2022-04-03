import { CrawlingRepository } from './crawling.repository';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { Content, ListId } from './crawing.types';

import * as cheerio from 'cheerio';
import axios from 'axios';
import { v1 as uuid } from 'uuid';
@Injectable()
export class CrawlingService {
  constructor(
    @InjectRepository(CrawlingRepository)
    private crawlingRepository: CrawlingRepository,
  ) {}

  private async getHtml(URL: string) {
    return await axios.get(URL);
  }

  private $(data: string | cheerio.Node | cheerio.Node[] | Buffer) {
    return cheerio.load(data);
  }

  okkyStartCrawling() {
    const getListId = ({ data }) => {
      const listId: ListId[] = [];

      this.$(data)('div.gathering-panel ul li')
        .find('span.article-id')
        .each((i, el) => {
          listId[i] = {
            listId: this.$(el).text().substring(1),
          };
        });

      return listId;
    };

    const getDetailContentList = async (listid: ListId[]) => {
      const detailContentList: Content[] = [];

      const pending = listid.map(({ listId }) =>
        this.getHtml(`https://okky.kr/article/${listId}`),
      );

      (await Promise.all(pending)).forEach(({ data }, index) => {
        const $headerList = this.$(data)('.panel-heading');
        const $bodyList = this.$(data)('#content-body');
        detailContentList[index] = {
          V_OTH_PRJ_ID: uuid(),
          V_OTH_TITLE: $bodyList.find('h2.panel-title').text(),
          T_OTH_CONTENT: $bodyList.children('article').html(),
          V_SITE_GUBUN: 'O',
          V_OTH_URL: `https://okky.kr/article/${listid[index].listId}`,
          V_REG_NM: $headerList.find('.nickname').text(),
          D_REG_DTM: new Date(
            $headerList
              .find('.date-created')
              .children('.timeago:eq(0)')
              .attr('title'),
          ),
        };
      });

      return detailContentList;
    };

    this.getHtml('https://okky.kr/articles/gathering')
      .then(getListId)
      .then(getDetailContentList)
      .then((items) => {
        items.forEach((item) => this.crawlingRepository.createContent(item));
      })
      .catch(console.error);
  }

  inflearnStartCrawling() {
    const getListId = ({ data }) => {
      const listId: ListId[] = [];

      this.$(data)('ul.question-list li.question-container a').each((i, el) => {
        listId[i] = {
          listId: el.attribs.href,
        };
      });
      return listId;
    };

    const getDetailContentList = async (listid: ListId[]) => {
      const detailContentList: Content[] = [];

      const pending = listid.map(({ listId }) =>
        this.getHtml(`https://www.inflearn.com${listId}`),
      );

      (await Promise.all(pending)).forEach(({ data }, index) => {
        const $headerList = this.$(data)('.community-post-info__header');
        const $bodyList = this.$(data)('.community-post-info__content');

        detailContentList[index] = {
          V_OTH_PRJ_ID: uuid(),
          V_OTH_TITLE: $headerList.find('.header__title h1').text(),
          T_OTH_CONTENT: $bodyList.find('.content__body').html(),
          V_SITE_GUBUN: 'I',
          V_OTH_URL: `https://www.inflearn.com${listid[index].listId}`,
          V_REG_NM: $headerList.find('.user-name').text(),
          D_REG_DTM: new Date(
            $headerList.find('.sub-title__created-at').text(),
          ),
        };
      });
      return detailContentList;
    };

    this.getHtml(
      'https://www.inflearn.com/community/studies?status=unrecruited',
    )
      .then(getListId)
      .then(getDetailContentList)
      .then((items) => {
        items.forEach((item) => this.crawlingRepository.createContent(item));
      })
      .catch(console.error);
  }
}
