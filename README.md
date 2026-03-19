# VizKids

| Student's name         | SCIPER |
| ---------------------- | ------ |
| Bochatay Robin         | 329724 |
| Foletti Nicholas       | 424298 |
| Ranieri Giovanni Luigi | 326870 |


[Milestone 1](#milestone-1) • [Milestone 2](#milestone-2) • [Milestone 3](#milestone-3)

## Milestone 1 (20th March, 5pm)
### Dataset

The dataset used in this project contains speeches delivered by member states during the United Nations General Assembly between 1970 and 2015. The dataset includes 7507 speeches from 199 countries, representing official statements by heads of state.

The dataset is particularly valuable because these speeches provide a comprehensive overview of how governments publicly express their priorities and perspectives on international issues. Topics commonly discussed include security, international cooperation, development, climate change, and global conflicts.

In terms of quality, the dataset is already well structured. All speeches have been translated into English. Older speeches (before the 1990s) were originally digitized from scanned documents, so minor text-cleaning may also be necessary. Overall, the dataset is well suited for text analysis and visualization.

### Problematic

The United Nations General Assembly General Debate is one of the most important annual events in international diplomacy. Each country presents its view on global issues and outlines its foreign policy priorities. Despite its importance, these speeches receive relatively little public attention compared to other geopolitical events.

The goal of this project is to visualize how the priorities and discourse of countries have evolved over time. By analyzing the content of speeches from 1970 to 2015, we aim to identify major trends in global political concerns.

The main questions explored in this project could be: What global issues dominate international discourse at different periods?, How do countries differ in the topics they emphasize? How do geopolitical events (e.g., Cold War, terrorism, climate change) influence the themes discussed in speeches? Are there identifiable blocs of countries with similar discourse?

The target audience includes students, researchers, and anyone interested in international relations or global politics. Through interactive visualizations, the project aims to make large-scale diplomatic discourse accessible and understandable to a broader audience.

### Exploratory Data Analysis

The dataset contains 7507 speeches spanning 46 years, with the number of participating countries increasing from around 70 in 1970 to over 190 in recent years. Each speech contains on average about 1037 unique words and 116 sentences, making the corpus a rich source of textual information. 

Initial preprocessing steps include: cleaning the text (removing punctuation, stopwords, etc.) and calculating word frequencies and topic distributions.

Preliminary exploration of the data can include: the most frequent words across decades, topic modeling to identify recurring themes (e.g., development, security, climate change), trends in the frequency of certain keywords over time, clustering countries based on speech similarity.

These analyses will help determine which aspects of the dataset are most interesting to visualize. For example, one promising direction is to track how the importance of specific topics (e.g., nuclear weapons, terrorism, climate change) evolves across decades and across regions.

### Related Work

The dataset comes with a paper from Baturo, Dasandi, and Mikhaylov. They introduce the dataset and demonstrate how text analysis methods can extract information about countries’ foreign policy priorities. 

Their work shows that speeches can reveal government preferences on global issues and can be analyzed using techniques such as topic modeling, text scaling, or correspondence analysis. These methods allow researchers to map countries’ political positions or detect alliances and ideological divisions. However, most existing research focuses on statistical modeling or political science analysis, rather than visual exploration of the data. Our approach aims to focus on interactive visualization, making these patterns accessible to a broader audience.

Inspirations for visualization styles come from projects such as: interactive geopolitical maps showing topic emphasis by country, timeline visualizations of topic evolution, network graphs showing similarity between countries’ discourse.

The originality of this project lies in combining text analysis with interactive visual storytelling, allowing users to explore how global political discourse evolves over time.


